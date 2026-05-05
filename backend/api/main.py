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
import numpy as np

# Import our components
from backend.agents.planner import PlannerAgent
from backend.services.memory import memory
from backend.services.notifications import notifications, NotifLevel
from backend.services.visual_features import visual_extractor
from backend.services.llm_advisor import get_advisor
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

        # Run workflow in a separate thread to avoid blocking the FastAPI event loop
        import asyncio
        results = await asyncio.to_thread(orchestrator.run, request.user_input)

        workflow_results[workflow_id] = {
            'success': results.get('success', False),
            'output': results.get('final_output'),
            'results': results,
            'completed_at': datetime.now().isoformat()
        }

        # Push notification for pipeline completion
        if results.get('success'):
            score = results.get('controller', {}).get('best_score', 0) if isinstance(results.get('controller'), dict) else 0
            notifications.pipeline_success(workflow_id, score, results.get('total_episodes', 0))
        else:
            notifications.pipeline_failed(workflow_id, results.get('error', 'Unknown error'))

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
        notifications.pipeline_failed(workflow_id, str(e))
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


from backend.agents.planner import TrainingPlan, Algorithm  # noqa: E402 (used in /play)


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


@app.get("/status/stream/{workflow_id}")
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
                yield f"data: {json.dumps(event, default=str)}\n\n"
                break
            elif workflow_id in active_workflows:
                status = active_workflows[workflow_id].get_status()
                event = {
                    "event": "progress",
                    "data": status,
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(event, default=str)}\n\n"
            else:
                event = {
                    "event": "error",
                    "data": {"message": "Workflow not found"},
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(event, default=str)}\n\n"
                break
            
            await asyncio.sleep(2)  # Poll every 2s
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/train")
async def train_agent(request: TrainRequest):
    """Synchronously train an RL agent."""
    try:
        trainer = RLTrainer()

        # Create environment (raw, no augmentation yet)
        env, env_factory = build_env(request.environment, level=request.level)

        # Validate base env before wrapping
        valid, msg = trainer.validate_environment(env)
        if not valid:
            raise HTTPException(status_code=400, detail=msg)

        # Only pass recognised SB3 hyperparameter keys to avoid unexpected-kwarg errors
        _SB3_KEYS = {
            'learning_rate', 'batch_size', 'gamma', 'n_steps', 'n_epochs',
            'gae_lambda', 'clip_range', 'ent_coef', 'vf_coef', 'max_grad_norm',
            'buffer_size', 'learning_starts', 'tau', 'train_freq',
            'gradient_steps', 'target_update_interval',
            'exploration_fraction', 'exploration_final_eps',
        }
        raw_hp = request.hyperparameters or {}
        filtered_hp = {k: v for k, v in raw_hp.items() if k in _SB3_KEYS}

        # Create model (attach_env + visual wrapper happen inside)
        success, msg = trainer.create_model(
            env=env,
            algorithm=request.algorithm or "PPO",
            config=filtered_hp if filtered_hp else None,
            env_id=request.environment,
            env_factory=env_factory,
        )
        if not success:
            raise HTTPException(status_code=400, detail=msg)

        # Train in a thread (non-blocking)
        import asyncio
        timesteps = request.total_timesteps or 50000
        metrics = await asyncio.to_thread(trainer.train, timesteps)

        # Compute summary metrics for the response
        rewards = metrics.get('episode_rewards', [])
        mean_reward = float(np.mean(rewards)) if rewards else 0.0

        # Save model + metadata
        model_path = trainer.save_model()

        return {
            "success": True,
            "model_path": model_path,
            "metrics": {
                **metrics,
                "mean_reward": mean_reward,
                "n_episodes": len(rewards),
            },
            "algorithm": request.algorithm or "PPO",
            "environment": request.environment,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
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

        import asyncio
        results = await asyncio.to_thread(trainer.evaluate, n_episodes=request.n_episodes)

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
        import asyncio
        success, results = await asyncio.to_thread(controller.run_until_goal, plan, 1)

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


# ── Pipeline Status Endpoint ────────────────────────────────────────────────

@app.get("/pipeline/status")
async def pipeline_status():
    """
    Returns the overall pipeline health:
    - Number of active workflows
    - Last completed experiment metadata
    - Available models count
    - Backend resources
    """
    import os
    import psutil

    model_dir = "data/models"
    model_count = len(os.listdir(model_dir)) if os.path.exists(model_dir) else 0

    try:
        cpu_pct = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        ram_pct = ram.percent
    except Exception:
        cpu_pct = 0.0
        ram_pct = 0.0

    return {
        "active_workflows": len(active_workflows),
        "completed_workflows": len(workflow_results),
        "model_count": model_count,
        "resources": {
            "cpu_percent": cpu_pct,
            "ram_percent": ram_pct,
        },
        "phase": "training" if active_workflows else "idle",
        "timestamp": datetime.now().isoformat(),
    }


# ── LLM-Assisted Inference Endpoint ─────────────────────────────────────────

@app.post("/inference/run")
async def run_inference_with_llm(
    model_path: Optional[str] = None,
    target_score: float = 500.0,
    max_episodes: int = 50,
    llm_provider: str = "none",
    environment: str = "AngryBird-v0",
    level: Optional[str] = "basic",
):
    """
    Run inference with optional LLM strategic advisor.

    The LLM advisor (Gemini / OpenRouter) assists with:
    - Shot trajectory selection
    - Bird-type prioritization
    - Multi-step planning

    Falls back to pure-RL policy when provider is 'none' or API key absent.
    """
    try:
        advisor = get_advisor(provider=llm_provider)

        # Select best model if not specified
        if not model_path:
            import os
            model_dir = "data/models"
            if os.path.exists(model_dir):
                models = sorted(
                    [f for f in os.listdir(model_dir) if f.endswith(".zip")],
                    reverse=True,  # Latest first
                )
                model_path = os.path.join(model_dir, models[0]) if models else None

        if not model_path:
            raise HTTPException(
                status_code=404,
                detail="No trained model found. Run the training pipeline first.",
            )

        # Load model and environment
        trainer = RLTrainer()
        if not trainer.load_model(model_path):
            raise HTTPException(status_code=404, detail="Model not found")

        env, env_factory = build_env(environment, level=level)
        trainer.attach_env(env, env_id=environment, env_factory=env_factory)

        controller = RuntimeController(trainer=trainer)

        from backend.agents.planner import TrainingPlan, GameType, Algorithm
        game_type = map_game_type(environment)

        plan = TrainingPlan(
            goal="target_score",
            target_value=target_score,
            game_type=game_type,
            algorithm=Algorithm.PPO,
            total_timesteps=10000,
            reward_strategy="default",
            success_criteria=f"Achieve score >= {target_score}",
        )

        controller.config.max_episodes = max_episodes

        import asyncio
        success, results = await asyncio.to_thread(controller.run_until_goal, plan, 1)

        llm_advice = None
        if advisor.is_enabled:
            llm_advice = advisor.advise_strategy(
                episode=results.get("total_episodes", 0),
                recent_rewards=[results.get("best_score", 0)],
                current_best=results.get("best_score", 0),
                target=target_score,
            )

        return {
            "success": success,
            "results": results,
            "llm_provider": llm_provider,
            "llm_advice": llm_advice,
            "model_path": model_path,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# memory is imported at top of file from backend.services.memory

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
    import shutil
    
    # Secure filename to prevent path traversal
    safe_name = os.path.basename(model_name)
    model_path = os.path.join("data/models", safe_name)
    
    if os.path.exists(model_path):
        try:
            if os.path.isdir(model_path):
                shutil.rmtree(model_path)
            else:
                os.remove(model_path)
            return {"deleted": safe_name}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete model: {e}")
            
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


# ── Visual Feature Endpoints ────────────────────────────────────────────────

@app.get("/visual-stats")
async def get_visual_stats():
    """Return visual feature extractor statistics."""
    return visual_extractor.get_statistics()

@app.api_route("/latest-frame", methods=["GET", "HEAD"])
async def get_latest_frame():
    """Returns the most recent frame generated by the RL agent for visualization."""
    from fastapi.responses import FileResponse
    import os
    
    stats = visual_extractor.get_statistics()
    # Visual extractor stores in _index["frames"]
    # Quickest way is to access the internal index if we want exact latest
    index = getattr(visual_extractor, '_index', {}).get("frames", [])
    if index:
        latest = index[-1]["img"]
        if os.path.exists(latest):
            # To prevent caching issues in browser, we can return the image directly
            return FileResponse(latest)
            
    raise HTTPException(status_code=404, detail="No frames available yet.")

# ── Notification Endpoints ──────────────────────────────────────────────────

@app.get("/notifications")
async def get_notifications(limit: int = 50, unread_only: bool = False):
    """Get all notifications, newest first."""
    items = notifications.get_all(limit=limit, unread_only=unread_only)
    return {"notifications": items, "unread_count": notifications.unread_count()}


@app.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    ok = notifications.mark_read(notif_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@app.post("/notifications/read-all")
async def mark_all_notifications_read():
    count = notifications.mark_all_read()
    return {"marked_read": count}


@app.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: int):
    ok = notifications.delete(notif_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@app.delete("/notifications")
async def clear_all_notifications():
    count = notifications.clear_all()
    return {"cleared": count}


@app.get("/notifications/unread-count")
async def get_unread_count():
    return {"count": notifications.unread_count()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
