"""
Workflow Orchestration using LangGraph.
Defines the agent workflow state machine for autonomous RL pipeline.
"""
from typing import Dict, Any, Optional
import logging

# Try to import LangGraph - graceful fallback if not available
try:
    from langgraph.graph import StateGraph, END
    try:
        from langgraph.checkpoint.memory import MemorySaver
    except ImportError:
        from langgraph.checkpoint import MemorySaver
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    MemorySaver = None
    logging.warning("LangGraph not available - using simple orchestration")

# Import our components
from backend.agents.planner import PlannerAgent
from backend.agents.reward_generator import RewardGenerator
from backend.rl.trainer import RLTrainer
from backend.runtime.controller import RuntimeController, ControllerConfig
from backend.workflows.state import WorkflowState, WorkflowConfig


INGESTION_STAGE_IDS = [
    "INTAKE",
    "ANALYZE",
    "VALIDATE",
    "WRAP_ENV",
    "COLLECT_DATA",
    "DISCOVER_REWARD",
    "TRAIN",
    "EVALUATE",
    "REGISTRY_SAVE",
    "DEPLOY_SIM",
    "DONE",
    "FAILED",
]


class WorkflowOrchestrator:

    """
    Main orchestrator that coordinates the autonomous RL pipeline
    using LangGraph state machine.
    """

    def __init__(self,
                 config: Optional[WorkflowConfig] = None,
                 memory_system=None):
        self.config = config or WorkflowConfig()
        self.memory = memory_system
        self.logger = logging.getLogger(__name__)

        # Initialize agents
        self.planner = PlannerAgent(memory_system=memory_system)
        self.reward_gen = RewardGenerator(memory_system=memory_system)
        self.trainer = RLTrainer()
        self.controller = RuntimeController(
            trainer=self.trainer,
            config=ControllerConfig()
        )

        # State tracking (authoritative mission control state for UI/SSE)
        self.current_state: Optional[WorkflowState] = None
        self.workflow_graph = None

        # Initialize graph if LangGraph available
        if LANGGRAPH_AVAILABLE:
            self._build_graph()


    def _build_graph(self):
        """Build the LangGraph workflow state machine."""
        workflow = StateGraph(WorkflowState)

        # Add nodes (each is a function that takes state and returns modified state)
        # NOTE: Stage telemetry is only partially covered by LangGraph in Phase 1.
        # The full stage list (INTAKE→...→DEPLOY_SIM→DONE/FAILED) is guaranteed by the
        # sequential fallback in `_run_simple()`.
        workflow.add_node("parse_goal", lambda s: self._stage_wrapper(s, "INTAKE", self._node_parse_goal))
        workflow.add_node("create_environment", lambda s: self._stage_wrapper(s, "WRAP_ENV", self._node_create_environment))
        workflow.add_node("train_model", lambda s: self._stage_wrapper(s, "TRAIN", self._node_train_model))
        workflow.add_node("evaluate_model", lambda s: self._stage_wrapper(s, "EVALUATE", self._node_evaluate_model))
        workflow.add_node("run_runtime", lambda s: self._stage_wrapper(s, "DEPLOY_SIM", self._node_run_runtime))

        workflow.add_node("check_result", self._node_check_result)


        # Define edges
        workflow.set_entry_point("parse_goal")
        workflow.add_edge("parse_goal", "create_environment")
        workflow.add_edge("create_environment", "train_model")
        workflow.add_edge("train_model", "evaluate_model")
        workflow.add_edge("evaluate_model", "run_runtime")
        workflow.add_edge("run_runtime", "check_result")

        # Conditional edges for retry logic
        workflow.add_conditional_edges(
            "check_result",
            self._should_retry,
            {
                # Phase 1 retry: re-run from ANALYZE step so stage telemetry updates coherently.
                "retry": "create_environment",
                "success": END,
                "fail": END,
            },
        )


        # Compile with checkpointer for state persistence
        if MemorySaver is not None:
            checkpointer = MemorySaver()
            self.workflow_graph = workflow.compile(checkpointer=checkpointer)
        else:
            self.workflow_graph = workflow.compile()

    def run(self, user_input: str, job_id: str = "default") -> Dict[str, Any]:

        """
        Run the complete workflow from user input to result.
        Returns final workflow state.

        Note: this method also updates `self.current_state` continuously
        so GET /status/stream can render authoritative stage list.
        """
        self.logger.info(f"Starting workflow for input: {user_input}")

        # Initialize workflow state (authoritative mission-control state)
        initial_state: WorkflowState = {
            'job_id': job_id,
            'user_input': user_input,
            'stages': {
                stage_id: {
                    'status': 'pending',
                    'started_at': None,
                    'completed_at': None,
                    'retry_count': 0,
                    'detail': None,
                }
                for stage_id in INGESTION_STAGE_IDS
            },
            'stage_logs': {stage_id: [] for stage_id in INGESTION_STAGE_IDS},
            'game_signature': None,
            'env_signature': None,
            'reward_config': None,
            'training_config': None,
            'metrics_summary': None,
            'deployed_model_id': None,

            # Legacy placeholders (compat)
            'plan': None,
            'planning_complete': False,
            'planning_error': None,

            'training_complete': False,
            'model_path': None,
            'training_metrics': None,
            'training_error': None,

            'evaluation_complete': False,
            'evaluation_results': None,
            'evaluation_error': None,

            'runtime_complete': False,
            'runtime_results': None,
            'runtime_error': None,

            'success': False,
            'final_output': None,
            'error_message': None,

            'iteration': 0,
            'max_iterations': self.config.max_iterations,
            'logs': []
        }

        # Make authoritative immediately visible to get_status()
        self.current_state = initial_state

        # Phase 1 reliability choice:
        # Keep LangGraph available for future streaming/state-machine work, but for now
        # guarantee NEW doc stage telemetry by always using the stage-driven sequential
        # implementation. This ensures UI/SSE progress is correct for every stage.
        final_state = self._run_simple(initial_state)
        self.current_state = final_state  # type: ignore[assignment]
        return dict(final_state)


    def _run_simple(self, state: WorkflowState) -> Dict[str, Any]:
        """Simple sequential execution without LangGraph. Stage-driven mission control."""
        self.logger.info("Running simple sequential workflow")

        def log(stage_id: str, msg: str) -> None:
            if 'stage_logs' in state:
                state['stage_logs'].setdefault(stage_id, []).append(msg)

        # Step 1: INTAKE (placeholder: parse goal/user input)
        state = self._node_mark_stage(state, "INTAKE", status="active")

        log("INTAKE", "INTAKE started")
        state = self._node_parse_goal(state)
        log("INTAKE", "Training plan parsed")
        state = self._node_mark_stage(state, "INTAKE", status="completed")

        if state.get('planning_error'):
            # Mark terminal stages
            state = self._node_mark_stage(state, "FAILED", status="error", detail=state.get('planning_error'))
            state['success'] = False
            state['error_message'] = state.get('planning_error')
            return dict(state)

        # Step 2: ANALYZE
        state = self._node_mark_stage(state, "ANALYZE", status="active")
        log("ANALYZE", "Static analysis placeholder running")
        state = self._node_mark_stage(state, "ANALYZE", status="completed", detail="Analysis placeholder complete")

        # Step 3: VALIDATE (sandbox smoke placeholder)
        state = self._node_mark_stage(state, "VALIDATE", status="active")
        log("VALIDATE", "Sandbox validation placeholder running")
        state = self._node_mark_stage(state, "VALIDATE", status="completed", detail="Sandbox smoke placeholder complete")

        # Step 4: WRAP_ENV (mapped to existing env creation)
        state = self._node_mark_stage(state, "WRAP_ENV", status="active")
        log("WRAP_ENV", "Generating environment wrapper (mapped to env creation)")
        state = self._node_create_environment(state)
        state = self._node_mark_stage(state, "WRAP_ENV", status="completed", detail="Environment wrapper ready")

        if state.get('training_error'):
            state = self._node_mark_stage(state, "FAILED", status="error", detail=state.get('training_error'))
            state['success'] = False
            state['error_message'] = state.get('training_error')
            return dict(state)

        # Step 5: COLLECT_DATA (placeholder)
        state = self._node_mark_stage(state, "COLLECT_DATA", status="active")
        log("COLLECT_DATA", "Trajectory mining placeholder running")
        state = self._node_mark_stage(state, "COLLECT_DATA", status="completed", detail="Initial replay buffer placeholder complete")

        # Step 6: DISCOVER_REWARD (placeholder)
        state = self._node_mark_stage(state, "DISCOVER_REWARD", status="active")
        log("DISCOVER_REWARD", "Reward discovery placeholder running")
        state = self._node_mark_stage(state, "DISCOVER_REWARD", status="completed", detail="Reward config placeholder complete")

        # Step 7: TRAIN (mapped to existing training)
        state = self._node_mark_stage(state, "TRAIN", status="active")
        log("TRAIN", "Training execution started")
        state = self._node_train_model(state)
        state = self._node_mark_stage(state, "TRAIN", status="completed", detail="Training complete")

        if state.get('training_error'):
            state = self._node_mark_stage(state, "FAILED", status="error", detail=state.get('training_error'))
            state['success'] = False
            state['error_message'] = state.get('training_error')
            return dict(state)

        # Step 8: EVALUATE (mapped to existing evaluation)
        state = self._node_mark_stage(state, "EVALUATE", status="active")
        log("EVALUATE", "Evaluation started")
        state = self._node_evaluate_model(state)
        state = self._node_mark_stage(state, "EVALUATE", status="completed", detail="Evaluation complete")

        if state.get('evaluation_error'):
            state = self._node_mark_stage(state, "FAILED", status="error", detail=state.get('evaluation_error'))
            state['success'] = False
            state['error_message'] = state.get('evaluation_error')
            return dict(state)

        # Step 9: REGISTRY_SAVE (placeholder)
        state = self._node_mark_stage(state, "REGISTRY_SAVE", status="active")
        log("REGISTRY_SAVE", "Registry save placeholder")
        # Minimal: mark ready; model_path already exists from training.
        state['deployed_model_id'] = state.get('model_path')
        state = self._node_mark_stage(state, "REGISTRY_SAVE", status="completed", detail="Registry metadata placeholder complete")

        # Step 10: DEPLOY_SIM (placeholder)
        state = self._node_mark_stage(state, "DEPLOY_SIM", status="active")
        log("DEPLOY_SIM", "Simulation deployment placeholder running")
        # Use existing runtime controller to simulate deployment outcome.
        state = self._node_run_runtime(state)
        state = self._node_mark_stage(state, "DEPLOY_SIM", status="completed", detail="Simulation deployment placeholder complete")

        if state.get('runtime_error'):
            state = self._node_mark_stage(state, "FAILED", status="error", detail=state.get('runtime_error'))
            state['success'] = False
            state['error_message'] = state.get('runtime_error')
            return dict(state)

        # Done
        state = self._node_mark_stage(state, "DONE", status="completed", detail="Workflow complete")
        state['success'] = True
        state['final_output'] = state.get('final_output') or "Workflow completed successfully"
        return dict(state)


    def _node_mark_stage(self, state: WorkflowState, stage_id: str, status: str, detail: Optional[str] = None) -> WorkflowState:
        """Update stage status and timestamps in workflow state."""
        if 'stages' not in state:
            return state
        stage = state['stages'].setdefault(stage_id, {
            'status': 'pending',
            'started_at': None,
            'completed_at': None,
            'retry_count': 0,
            'detail': None,
        })

        if status == 'active' and not stage.get('started_at'):
            import datetime
            stage['started_at'] = datetime.datetime.now().isoformat()
        if status in ('completed', 'error'):
            import datetime
            if not stage.get('completed_at'):
                stage['completed_at'] = datetime.datetime.now().isoformat()

        stage['status'] = status
        if detail is not None:
            stage['detail'] = detail
        return state

    # Node implementations

    def _node_parse_goal(self, state: WorkflowState) -> WorkflowState:
        """Parse natural language input into training plan."""
        try:
            plan = self.planner.parse_goal(state['user_input'])
            state['plan'] = plan
            state['planning_complete'] = True
            state['logs'].append(f"Created training plan: {plan.goal} for {plan.game_type.value}")
        except Exception as e:
            state['planning_error'] = str(e)
            state['logs'].append(f"Planning failed: {e}")

        return state

    def _node_create_environment(self, state: WorkflowState) -> WorkflowState:
        """Create and validate environment based on plan."""
        try:
            plan = state['plan']
            if not plan:
                raise ValueError("No training plan available")

            # Use the canonical factory for all environments
            from backend.core.env_factory import build_env
            level = plan.metadata.get('level', 'basic')
            env, env_factory = build_env(plan.game_type.value, level=level)

            # Validate environment
            valid, msg = self.trainer.validate_environment(env)
            if not valid:
                raise ValueError(f"Environment validation failed: {msg}")

            # Setup trainer with environment and factory
            self.trainer.attach_env(
                env,
                env_id=plan.game_type.value,
                env_factory=env_factory,
                visual_augment=True,
            )
            state['logs'].append(f"Created environment: {plan.game_type.value}")

        except Exception as e:
            state['training_error'] = str(e)
            state['logs'].append(f"Environment creation failed: {e}")

        return state

    def _node_train_model(self, state: WorkflowState) -> WorkflowState:
        """Train RL model according to plan."""
        try:
            plan = state['plan']
            if not plan:
                raise ValueError("No training plan available")

            # Create model
            success, msg = self.trainer.create_model(
                env=self.trainer.env,
                algorithm=plan.algorithm.value,
                config=plan.hyperparameters
            )

            if not success:
                raise ValueError(f"Model creation failed: {msg}")

            state['logs'].append(f"Created {plan.algorithm.value} model")

            # Train
            metrics = self.trainer.train(
                total_timesteps=plan.total_timesteps
            )

            state['training_metrics'] = metrics
            state['training_complete'] = True

            # Save model
            model_path = self.trainer.save_model()
            state['model_path'] = model_path
            state['logs'].append(f"Model trained and saved: {model_path}")

        except Exception as e:
            state['training_error'] = str(e)
            state['logs'].append(f"Training failed: {e}")

        return state

    def _node_evaluate_model(self, state: WorkflowState) -> WorkflowState:
        """Evaluate trained model performance."""
        try:
            eval_results = self.trainer.evaluate(n_episodes=100)
            state['evaluation_results'] = eval_results
            state['evaluation_complete'] = True
            state['logs'].append(
                f"Evaluation: mean_reward={eval_results['mean_reward']:.2f}, "
                f"success_rate={eval_results['success_rate']:.2f}"
            )
        except Exception as e:
            state['evaluation_error'] = str(e)
            state['logs'].append(f"Evaluation failed: {e}")

        return state

    def _node_run_runtime(self, state: WorkflowState) -> WorkflowState:
        """Run runtime controller to achieve goal (bounded)."""
        try:
            plan = state.get('plan') if isinstance(state, dict) else state['plan']
            if not plan:
                raise ValueError("No plan available")

            # Use a tightly-bounded config for the orchestrator's runtime phase
            from backend.runtime.controller import ControllerConfig
            bounded_cfg = ControllerConfig(
                max_episodes=50,
                eval_frequency=10,
                retry_limit=1,
                early_stopping_patience=3,
                render_during_eval=False,
            )
            self.controller.config = bounded_cfg

            success, results = self.controller.run_until_goal(plan, max_retries=1)
            state['runtime_results'] = results
            state['runtime_complete'] = True
            state['logs'].append(
                f"Runtime complete: success={success}, "
                f"episodes={results.get('episodes', 0)}"
            )
        except Exception as e:
            state['runtime_error'] = str(e)
            state['logs'].append(f"Runtime failed: {e}")

        return state

    def _node_check_result(self, state: WorkflowState) -> WorkflowState:
        """Determine if goal achieved or need to retry."""
        runtime_results = (state.get('runtime_results') or {}) if isinstance(state, dict) else (state['runtime_results'] or {})
        success = runtime_results.get('success', False)

        state['success'] = success
        state['iteration'] = state.get('iteration', 0) + 1   # always advance

        if success:
            state['final_output'] = (
                f"Goal achieved in {runtime_results.get('episodes', 0)} episodes. "
                f"Final score: {runtime_results.get('final_score', 0):.2f}"
            )
            state['logs'].append("Workflow completed successfully")
        else:
            state['error_message'] = "Failed to achieve goal within retry limit"
            state['logs'].append("Workflow failed after maximum retries")

        return state

    def _should_retry(self, state: WorkflowState) -> str:
        """Decide whether to retry, succeed, or fail."""
        # Always increment iteration so we can't loop forever
        iteration  = (state.get('iteration') or 0)
        max_iters  = (state.get('max_iterations') or self.config.max_iterations)

        if not self.config.enable_retry:
            return "success" if state.get('success') else "fail"

        if iteration >= max_iters:
            return "fail"

        if state.get('success'):
            return "success"

        return "retry"

    def get_status(self) -> Dict[str, Any]:
        """Get current workflow status.

        Returns a structured payload that the frontend can render as:
        - Mission Control / pipeline stage statuses
        - Resource utilization and adaptive decisions
        - Alerts and actionable hints
        """

        # Stage-driven phase inference (authoritative)
        stages = getattr(self, 'current_state', {}) if getattr(self, 'current_state', None) else {}
        phase = 'idle'

        if getattr(self.trainer, 'env', None) is not None:
            phase = 'collecting'
        if getattr(self.trainer, 'model', None) is not None:
            phase = 'training'
        if getattr(self, 'current_state', None) is not None and isinstance(self.current_state, dict):
            if self.current_state.get('evaluation_complete'):
                phase = 'evaluating'
            if self.current_state.get('runtime_complete'):
                phase = 'done' if self.current_state.get('success') else 'failed'

        # Runtime controller stats (episodes)
        controller_stats = self.controller.get_progress_stats()

        # Resource snapshot (from resource controller if needed; controller stats may not include RAM/VRAM)
        resources = {}
        try:
            from backend.agents.resource_controller import ResourceController
            rc = ResourceController()
            resources = rc.get_system_stats()
        except Exception:
            resources = {
                'ram_percent': None,
                'cpu_percent': None,
                'vram_percent': None,
            }

        # Alerting based on resource thresholds
        alerts = []
        try:
            v = float(resources.get('vram_percent') or 0)
            r = float(resources.get('ram_percent') or 0)
            if v > 95.0:
                alerts.append({'severity': 'critical', 'title': 'VRAM overload', 'message': 'VRAM is critically high. Prefer CPU/offload / tiny policy.'})
            elif v > 85.0:
                alerts.append({'severity': 'high', 'title': 'VRAM pressure', 'message': 'VRAM is elevated. Reduce batch size / resolution / evaluation frequency.'})

            if r > 95.0:
                alerts.append({'severity': 'critical', 'title': 'RAM overload', 'message': 'RAM spike detected. Reduce replay buffer / workers.'})
            elif r > 85.0:
                alerts.append({'severity': 'high', 'title': 'RAM pressure', 'message': 'RAM is elevated. Consider smaller replay / fewer parallel environments.'})
        except Exception:
            pass

        # Convert current_state stages (if available) into the UI-friendly steps array.
        steps = []
        if getattr(self, 'current_state', None) and isinstance(self.current_state, dict):
            st = self.current_state.get('stages') or {}
            for stage_id in INGESTION_STAGE_IDS:
                s = st.get(stage_id) or {'status': 'pending', 'retry_count': 0}

                # Map stage_id -> label (simple for now; UI will display id otherwise)
                label_map = {
                    "INTAKE": "Upload & Ingest",
                    "ANALYZE": "Game Analysis",
                    "VALIDATE": "Sandbox Validation",
                    "WRAP_ENV": "Environment Wrapper",
                    "COLLECT_DATA": "Trajectory Mining",
                    "DISCOVER_REWARD": "Reward Discovery",
                    "TRAIN": "Training",
                    "EVALUATE": "Evaluation",
                    "REGISTRY_SAVE": "Registry Save",
                    "DEPLOY_SIM": "Deploy Simulation",
                    "DONE": "Done",
                    "FAILED": "Failed",
                }
                steps.append({
                    'id': stage_id,
                    'label': label_map.get(stage_id, stage_id),
                    'status': s.get('status', 'pending'),
                    'retry_count': s.get('retry_count', 0),
                    'detail': s.get('detail')
                })

        return {
            'phase': phase,
            'pipeline': {
                'steps': steps,
                'alerts': alerts,
            },

            'controller': controller_stats,
            'trainer': {
                'model_loaded': self.trainer.model is not None,
                'config': self.trainer.config,
            },
            'resources': resources,
        }

