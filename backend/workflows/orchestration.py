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

        # State tracking
        self.current_state = None
        self.workflow_graph = None

        # Initialize graph if LangGraph available
        if LANGGRAPH_AVAILABLE:
            self._build_graph()

    def _build_graph(self):
        """Build the LangGraph workflow state machine."""
        workflow = StateGraph(WorkflowState)

        # Add nodes (each is a function that takes state and returns modified state)
        workflow.add_node("parse_goal", self._node_parse_goal)
        workflow.add_node("create_environment", self._node_create_environment)
        workflow.add_node("train_model", self._node_train_model)
        workflow.add_node("evaluate_model", self._node_evaluate_model)
        workflow.add_node("run_runtime", self._node_run_runtime)
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
                "retry": "create_environment",  # Retry with modified plan
                "success": END,
                "fail": END
            }
        )

        # Compile with checkpointer for state persistence
        if MemorySaver is not None:
            checkpointer = MemorySaver()
            self.workflow_graph = workflow.compile(checkpointer=checkpointer)
        else:
            self.workflow_graph = workflow.compile()

    def run(self, user_input: str) -> Dict[str, Any]:
        """
        Run the complete workflow from user input to result.

        Args:
            user_input: Natural language goal description

        Returns:
            Final workflow state with results
        """
        self.logger.info(f"Starting workflow for input: {user_input}")

        # Initialize workflow state
        initial_state: WorkflowState = {
            'user_input': user_input,
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

        if LANGGRAPH_AVAILABLE and self.workflow_graph:
            try:
                # Use LangGraph execution
                config = {"configurable": {"thread_id": "default"}}
                final_state = self.workflow_graph.invoke(initial_state, config)
                return dict(final_state)
            except Exception as e:
                self.logger.error(f"LangGraph execution failed: {e}")
                # Fall back to simple sequential execution
                return self._run_simple(initial_state)
        else:
            # Simple sequential execution
            return self._run_simple(initial_state)

    def _run_simple(self, state: WorkflowState) -> Dict[str, Any]:
        """Simple sequential execution without LangGraph."""
        self.logger.info("Running simple sequential workflow")

        # Step 1: Parse goal
        state = self._node_parse_goal(state)

        if state.get('planning_error'):
            return dict(state)

        # Step 2: Create environment
        state = self._node_create_environment(state)

        if state.get('training_error'):
            return dict(state)

        # Step 3: Train model
        state = self._node_train_model(state)

        if state.get('training_error'):
            return dict(state)

        # Step 4: Evaluate model
        state = self._node_evaluate_model(state)

        if state.get('evaluation_error'):
            return dict(state)

        # Step 5: Run runtime
        state = self._node_run_runtime(state)

        if state.get('runtime_error'):
            return dict(state)

        # Step 6: Check result
        state = self._node_check_result(state)

        return dict(state)

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
        """Get current workflow status."""
        return {
            'controller': self.controller.get_progress_stats(),
            'trainer': {
                'model_loaded': self.trainer.model is not None,
                'config': self.trainer.config
            }
        }
