"""Workflow state and configuration models."""
from typing import Dict, Any, Optional, TypedDict, List, Annotated

from dataclasses import dataclass
import operator

from backend.agents.planner import TrainingPlan


class IngestionStageId(str):
    pass


class WorkflowState(TypedDict):

    """State object that flows through the workflow nodes."""
    job_id: str

    # For now we keep the old goal text; Phase 2 will replace this with ZIP upload metadata.
    user_input: str

    plan: Optional[TrainingPlan]
    planning_complete: bool
    planning_error: Optional[str]

    # Stage-driven mission control state
    stages: Dict[str, Dict[str, Any]]  # {stage_id: {status, started_at, completed_at, retry_count, detail}}
    stage_logs: Dict[str, List[str]]   # {stage_id: [log lines...]}

    # Must-have workflow outputs from NEW_UIUX_GAME_CODE_INGESTION_WORKFLOW.md
    game_signature: Optional[str]
    env_signature: Optional[str]
    reward_config: Optional[Dict[str, Any]]
    training_config: Optional[Dict[str, Any]]
    metrics_summary: Optional[Dict[str, Any]]
    deployed_model_id: Optional[str]

    # Legacy training/eval/runtime artifacts (kept temporarily for compatibility)
    training_complete: bool
    model_path: Optional[str]
    training_metrics: Optional[Dict[str, Any]]
    training_error: Optional[str]

    evaluation_complete: bool
    evaluation_results: Optional[Dict[str, Any]]
    evaluation_error: Optional[str]

    runtime_complete: bool
    runtime_results: Optional[Dict[str, Any]]
    runtime_error: Optional[str]

    success: bool
    final_output: Optional[str]
    error_message: Optional[str]

    iteration: int
    max_iterations: int
    logs: Annotated[List[str], operator.add]



@dataclass
class WorkflowConfig:
    """Configuration for workflow execution."""
    max_iterations: int = 3
    enable_retry: bool = True
    enable_curriculum: bool = True
    checkpoint_dir: str = "data/checkpoints"
    verbose: bool = True

    # Stage retry behavior
    stage_retry_limit: int = 1


