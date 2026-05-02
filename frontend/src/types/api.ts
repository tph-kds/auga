// API Types for the Autonomous RL Agent System

export interface TrainingPlan {
  goal: string;
  target_value: number;
  game_type: string;
  algorithm: string;
  total_timesteps: number;
  reward_strategy: string;
  success_criteria: string;
  constraints: string[];
  hyperparameters: Record<string, number | string>;
  metadata: {
    raw_input: string;
    parsed_at: string;
    planner_version: string;
  };
}

export interface WorkflowResponse {
  success: boolean;
  workflow_id: string;
  final_output: string | null;
  results: Record<string, unknown>;
  error: string | null;
}

export interface ModelInfo {
  name: string;
  path: string;
  algorithm: string;
  environment: string;
  created_at: string;
  size: string;
  tags: string[];
}

export interface StatusResponse {
  status: 'running' | 'completed' | 'failed' | 'not_found';
  details: {
    controller?: {
      total_episodes_played: number;
      mean_recent_score: number;
      best_score: number;
      success_rate: number;
      consecutive_successes: number;
      retry_count: number;
      state: string;
    };
    trainer?: {
      model_loaded: boolean;
      config: Record<string, unknown>;
    };
  };
}

export interface TrainRequest {
  environment: string;
  algorithm?: string;
  total_timesteps?: number;
  target_score?: number;
  level?: string;
  hyperparameters?: Record<string, number>;
}

export interface TrainResponse {
  success: boolean;
  model_path: string;
  metrics: {
    episode_rewards: number[];
    episode_lengths: number[];
    timesteps: number[];
    total_timesteps: number;
    mean_reward?: number;
  };
  algorithm: string;
  environment: string;
}

export interface EvaluateRequest {
  model_path: string;
  environment: string;
  n_episodes?: number;
  level?: string;
}

export interface EvaluateResponse {
  success: boolean;
  results: {
    mean_reward: number;
    std_reward: number;
    mean_length: number;
    success_rate: number;
  };
}

export interface PlayRequest {
  model_path: string;
  environment: string;
  target: number;
  max_episodes?: number;
  render?: boolean;
  level?: string;
}

export interface PlayResponse {
  success: boolean;
  results: {
    success: boolean;
    episodes: number;
    final_score: number;
    best_score: number;
    time_elapsed: number;
    retries: number;
  };
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolsResponse {
  tools: ToolSchema[];
}

export interface ExecuteToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ExecuteToolResponse {
  result: unknown;
  error?: string;
}

export interface GoalRequest {
  user_input: string;
  max_iterations?: number;
  enable_curriculum?: boolean;
  callback_url?: string;
}

export interface PlanResponse {
  goal: string;
  target_value: number;
  game_type: string;
  algorithm: string;
  total_timesteps: number;
  reward_strategy: string;
  success_criteria: string;
  constraints: string[];
  hyperparameters: Record<string, number | string>;
  metadata: Record<string, unknown>;
}

// Angry Birds Specific Types
export interface AngryBirdState {
  bird_position: { x: number; y: number };
  bird_velocity: { x: number; y: number };
  slingshot_position: { x: number; y: number };
  target_position: { x: number; y: number };
  structures: Structure[];
  pigs: Pig[];
  score: number;
  is_done: boolean;
}

export interface Structure {
  id: string;
  type: 'wood' | 'stone' | 'ice';
  position: { x: number; y: number };
  health: number;
  width: number;
  height: number;
}

export interface Pig {
  id: string;
  position: { x: number; y: number };
  health: number;
  radius: number;
}

export interface AngryBirdAction {
  angle: number;     // Launch angle in degrees
  power: number;     // Launch power (0-1)
  bird_type: 'red' | 'yellow' | 'blue' | 'black';
}

// WebSocket types for real-time updates
export interface TrainingProgress {
  episode: number;
  total_reward: number;
  score: number;
  timestep: number;
  eta_seconds?: number;
}

export interface WebSocketMessage {
  type: 'progress' | 'complete' | 'error' | 'status';
  data: TrainingProgress | WorkflowResponse | Record<string, unknown>;
  timestamp: string;
}
