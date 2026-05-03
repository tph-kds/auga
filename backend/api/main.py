"""
FastAPI Backend: Main API server for the autonomous RL agent system.
Provides REST endpoints for goal input, training, evaluation, and management.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import Optional, Dict, Any, List
import asyncio
import logging
from datetime import datetime
import json
import urllib.request

# Import our components
from backend.workflows.orchestration import WorkflowOrchestrator, WorkflowConfig
from backend.rl.trainer import RLTrainer
from backend.runtime.controller import RuntimeController
from backend.registry.tools import tool_registry
from backend.api.schemas import (
    GoalRequest,
    TrainRequest,
    EvaluateRequest,
    PlayRequest,
    ToolExecuteRequest,
    StatusResponse,
    WorkflowResponse,
)
from backend.core.env_factory import build_env, map_game_type

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Autonomous RL Agent System",
    description="Claude Code-compatible autonomous AI Engineer for RL training and gameplay",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for active workflows
active_workflows: Dict[str, WorkflowOrchestrator] = {}
workflow_results: Dict[str, Dict] = {}


# Background task function
async def run_workflow_background(workflow_id: str, request: GoalRequest):
    """Run workflow in background and store results."""
    try:
        config = WorkflowConfig(
            max_iterations=request.max_iterations,
            enable_curriculum=request.enable_curriculum
        )

        orchestrator = WorkflowOrchestrator(config=config)
        active_workflows[workflow_id] = orchestrator

        # Run workflow (blocking)
        results = orchestrator.run(request.user_input)

        workflow_results[workflow_id] = {
            'success': results.get('success', False),
            'output': results.get('final_output'),
            'results': results,
            'completed_at': datetime.now().isoformat()
        }

        # Send callback if provided
        if request.callback_url:
            payload = {
                'workflow_id': workflow_id,
                'success': results.get('success', False),
                'output': results.get('final_output'),
                'results': results,
                'completed_at': workflow_results[workflow_id]['completed_at']
            }
            try:
                await asyncio.to_thread(_post_webhook, request.callback_url, payload)
            except Exception as e:
                logger.warning(f"Webhook delivery failed: {e}")

    except Exception as e:
        workflow_results[workflow_id] = {
            'success': False,
            'error': str(e),
            'completed_at': datetime.now().isoformat()
        }
    finally:
        if workflow_id in active_workflows:
            del active_workflows[workflow_id]


def _post_webhook(callback_url: str, payload: Dict[str, Any]) -> None:
    """Send workflow completion payload to a webhook URL."""
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        callback_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()


from backend.agents.planner import TrainingPlan, Algorithm


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Autonomous RL Agent System",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "POST /goal": "Submit natural language goal (async)",
            "POST /train": "Train RL agent (sync)",
            "POST /evaluate": "Evaluate model",
            "POST /play": "Run agent in environment",
            "GET /status/{workflow_id}": "Check workflow status",
            "GET /tools": "Get available Claude Code tools",
            "POST /tools/execute": "Execute a tool"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/goal", response_model=WorkflowResponse)
async def submit_goal(request: GoalRequest, background_tasks: BackgroundTasks):
    """
    Submit a natural language goal for autonomous processing.
    Runs asynchronously and returns a workflow ID for tracking.
    """
    workflow_id = f"workflow_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

    # Save initial plan to memory
    planner = PlannerAgent(memory_system=memory)
    initial_plan = planner.parse_goal(request.user_input)
    memory.save_plan(
        workflow_id=workflow_id,
        user_input=request.user_input,
        plan=initial_plan.to_dict(),
        environment=initial_plan.game_type.value,
        algorithm=initial_plan.algorithm.value,
        target_score=initial_plan.target_value
    )

    background_tasks.add_task(run_workflow_background, workflow_id, request)

    return WorkflowResponse(
        success=True,
        workflow_id=workflow_id,
        final_output=None,
        results={"status": "started", "initial_plan": initial_plan.to_dict()},
        error=None
    )


@app.get("/status/{workflow_id}", response_model=StatusResponse)
async def get_status(workflow_id: str):
    """Legacy polling endpoint for status (deprecated, use SSE)."""
    if workflow_id in workflow_results:
        result = workflow_results[workflow_id]
        return StatusResponse(
            status="completed",
            details=result
        )
    elif workflow_id in active_workflows:
        orchestrator = active_workflows[workflow_id]
        return StatusResponse(
            status="running",
            details=orchestrator.get_status()
        )
    else:
        raise HTTPException(status_code=404, detail="Workflow not found")


@app.get("/status/{workflow_id}/stream")
async def status_stream(workflow_id: str):
    """Server-Sent Events stream for real-time workflow status."""
    import asyncio
    from fastapi.responses import StreamingResponse
    
    async def event_generator():
        while True:
            if workflow_id in workflow_results:
                event = {
                    "event": "complete",
                    "data": workflow_results[workflow_id],
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(event)}\n\n"
                break
            elif workflow_id in active_workflows:
                status = active_workflows[workflow_id].get_status()
                event = {
                    "event": "progress",
                    "data": status,
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(event)}\n\n"
            else:
                event = {
                    "event": "error",
                    "data": {"message": "Workflow not found"},
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(event)}\n\n"
                break
            
            await asyncio.sleep(2)  # Poll every 2s
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/train")
async def train_agent(request: TrainRequest):
    """Synchronously train an RL agent."""
    try:
        trainer = RLTrainer()

        # Create environment
        env, env_factory = build_env(request.environment, level=request.level)

        # Validate
        valid, msg = trainer.validate_environment(env)
        if not valid:
            raise HTTPException(status_code=400, detail=msg)

        # Create model
        success, msg = trainer.create_model(
            env=env,
            algorithm=request.algorithm,
            config=request.hyperparameters,
            env_id=request.environment,
            env_factory=env_factory
        )
        if not success:
            raise HTTPException(status_code=400, detail=msg)

        # Train
        metrics = trainer.train(total_timesteps=request.total_timesteps)

        # Save
        model_path = trainer.save_model()

        return {
            "success": True,
            "model_path": model_path,
            "metrics": metrics,
            "algorithm": request.algorithm,
            "environment": request.environment
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate")
async def evaluate_model(request: EvaluateRequest):
    """Evaluate a trained model."""
    try:
        trainer = RLTrainer()

        if not trainer.load_model(request.model_path):
            raise HTTPException(status_code=404, detail="Model not found")

        env, env_factory = build_env(request.environment, level=request.level)
        trainer.attach_env(env, env_id=request.environment, env_factory=env_factory)

        results = trainer.evaluate(n_episodes=request.n_episodes)

        return {
            "success": True,
            "results": results
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/play")
async def run_runtime(request: PlayRequest):
    """Run agent in environment until goal reached."""
    try:
        trainer = RLTrainer()
        controller = RuntimeController(trainer=trainer)

        if not trainer.load_model(request.model_path):
            raise HTTPException(status_code=404, detail="Model not found")

        env, env_factory = build_env(request.environment, level=request.level)
        trainer.attach_env(env, env_id=request.environment, env_factory=env_factory)

        # Create plan
        from backend.agents.planner import TrainingPlan, GameType, Algorithm

        # Determine game type from environment
        game_type = map_game_type(request.environment)

        plan = TrainingPlan(
            goal="target_score",
            target_value=request.target,
            game_type=game_type,
            algorithm=Algorithm.PPO,
            total_timesteps=10000,
            reward_strategy="default",
            success_criteria=f"Achieve score >= {request.target}"
        )

        controller.config.render_during_eval = request.render
        success, results = controller.run_until_goal(plan, max_retries=1)

        return {
            "success": success,
            "results": results
        }

    except Exception as e:
        logger.error(f"Runtime failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools")
async def get_tools():
    """Get available Claude Code compatible tools."""
    return {"tools": tool_registry.get_schemas()}


@app.post("/tools/execute")
async def execute_tool(request: ToolExecuteRequest):
    """Execute a tool by name."""
    result = tool_registry.execute(request.name, request.arguments)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result


from backend.services.memory_fixed import memory as memory  # Fixed global instance

@app.get("/plans")
async def list_plans():
    """List available training plans from memory."""
    plans = memory.get_recent_plans(limit=10)
    return {"plans": plans}


@app.get("/models")
async def list_models():
    """List saved models."""
    import os
    model_dir = "data/models"
    if os.path.exists(model_dir):
        models = os.listdir(model_dir)
        return {"models": models}
    return {"models": []}


@app.delete("/models/{model_name}")
async def delete_model(model_name: str):
    """Delete a saved model."""
    import os
    model_path = os.path.join("data/models", model_name)
    if os.path.exists(model_path):
        os.remove(model_path)
        return {"deleted": model_name}
    raise HTTPException(status_code=404, detail="Model not found")


@app.get("/models/{model_name}/metadata")
async def get_model_metadata(model_name: str):
    """Get metadata for a saved model."""
    import os
    import json
    
    safe_name = os.path.basename(model_name)
    meta_path = os.path.join("data/models", safe_name.replace('.zip', '_meta.json'))
    
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            metadata = json.load(f)
        return {"model": safe_name, "metadata": metadata}
    
    raise HTTPException(status_code=404, detail="Model metadata not found")


@app.get("/models/{model_name}/download")
async def download_model(model_name: str):
    """Download a saved model."""
    import os

    safe_name = os.path.basename(model_name)
    model_path = os.path.join("data/models", safe_name)
    if os.path.exists(model_path):
        return FileResponse(model_path, filename=safe_name)
    raise HTTPException(status_code=404, detail="Model not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
