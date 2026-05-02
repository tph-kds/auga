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
