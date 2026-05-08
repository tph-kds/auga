"""Pydantic request/response models for the API layer."""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class GoalRequest(BaseModel):
    """Request model for submitting a natural language goal."""
    user_input: str = Field(..., description="Natural language description of the RL goal")
    max_iterations: int = Field(3, description="Maximum retry iterations")
    enable_curriculum: bool = Field(True, description="Enable curriculum learning")
    callback_url: Optional[str] = Field(None, description="Webhook URL for async completion")


class TrainRequest(BaseModel):
    """Request model for training an agent."""
    environment: str = Field(..., description="Gymnasium environment name")
    algorithm: str = Field("PPO", description="RL algorithm to use")
    total_timesteps: int = Field(100000, description="Total training timesteps")
    target_score: float = Field(100.0, description="Target score to achieve")
    level: str = Field("basic", description="Level name for Angry Birds (basic, medium, advanced)")
    hyperparameters: Optional[Dict[str, Any]] = Field(None, description="Algorithm hyperparameters")


class EvaluateRequest(BaseModel):
    """Request model for evaluation."""
    model_path: str = Field(..., description="Path to model file")
    environment: str = Field(..., description="Gymnasium environment name")
    n_episodes: int = Field(100, description="Number of evaluation episodes")
    level: str = Field("basic", description="Level for Angry Birds")


class PlayRequest(BaseModel):
    """Request model for runtime execution."""
    model_path: str = Field(..., description="Path to model file")
    environment: str = Field(..., description="Gymnasium environment name")
    target: float = Field(..., description="Target value to achieve")
    max_episodes: int = Field(1000, description="Maximum episodes to run")
    render: bool = Field(False, description="Render gameplay")
    level: str = Field("basic", description="Level for Angry Birds")


class ToolExecuteRequest(BaseModel):
    """Request model for tool execution."""
    name: str = Field(..., description="Tool name")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool arguments")


class StatusResponse(BaseModel):
    """Response model for status checks."""
    status: str
    details: Dict[str, Any]


class WorkflowResponse(BaseModel):
    """Response model for workflow execution."""
    success: bool
    workflow_id: str
    final_output: Optional[str]
    results: Dict[str, Any]
    error: Optional[str]


class SSEStatusEvent(BaseModel):
    """Event model for Server-Sent Events status stream."""
    event: str  # "progress", "complete", "error"
    data: Dict[str, Any]
    timestamp: str


class UploadGameRequest(BaseModel):
    """Request model for uploading a game codebase (ZIP)."""
    # This is a placeholder for multipart endpoint; file arrives via FastAPI UploadFile
    user_goal: str = Field(..., description="Natural language goal for training this uploaded game")
    max_iterations: int = Field(3, description="Maximum retry iterations")
    enable_curriculum: bool = Field(True, description="Enable curriculum learning")
    callback_url: Optional[str] = Field(None, description="Webhook URL for async completion")


class JobStage(BaseModel):
    id: str
    label: Optional[str] = None
    status: str  # pending|active|done|error
    retry_count: int = 0
    detail: Optional[str] = None


class PipelineStep(BaseModel):
    id: str
    label: Optional[str] = None
    status: str
    retry_count: int = 0
    detail: Optional[str] = None


class PipelineStatus(BaseModel):
    phase: str
    steps: list[PipelineStep]
    alerts: list[Dict[str, Any]] = Field(default_factory=list)


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # running|completed|failed (or internal labels)
    pipeline: Optional[PipelineStatus] = None
    controller: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    trainer: Optional[Dict[str, Any]] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class SSEJobStatusPayload(BaseModel):
    workflow_id: str
    job: Dict[str, Any]
    status: JobStatusResponse


