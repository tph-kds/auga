# Auga RLAI - Autonomous Goal-Driven RL Agent System

Auga RLAI is a fully autonomous AI engineering system that accepts natural language goals, trains RL agents, and runs them until the goal is achieved. The primary example environment is Angry Birds, with support for additional Gymnasium tasks.

## Overview

- Natural language goals to structured training plans
- Reward shaping per environment and goal type
- PPO/A2C/DQN training with evaluation loops
- Runtime controller that tracks goal achievement and retries
- Claude Code compatible tool registry
- FastAPI backend and Next.js dashboard
- Docker sandbox and validation hooks

## Architecture

```
User Input
  -> Planner Agent
  -> Reward Generator
  -> RL Trainer
  -> Runtime Controller
  -> Goal Check (success or retry)
```

## Supported Environments

- AngryBird-v0 (primary example)
- CartPole-v1
- FlappyBird-v0

## Quick Start

Backend:
```bash
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.api.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Open:
- http://localhost:3000 (dashboard)
- http://localhost:8000/docs (API docs)

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | / | API info |
| GET | /health | Health check |
| POST | /goal | Submit natural language goal (async) |
| GET | /status/{id} | Workflow status |
| POST | /train | Train RL agent |
| POST | /evaluate | Evaluate a saved model |
| POST | /play | Run a saved model until target |
| GET | /tools | Claude Code tools |
| POST | /tools/execute | Execute a tool |
| GET | /models | List saved models |
| GET | /models/{name}/download | Download a model |
| DELETE | /models/{name} | Delete a model |

Example: submit goal
```bash
curl -X POST http://localhost:8000/goal \
  -H "Content-Type: application/json" \
  -d '{"user_input": "Destroy all pigs in Angry Birds using the fewest birds"}'
```

Example: train
```bash
curl -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{"environment": "AngryBird-v0", "algorithm": "PPO", "total_timesteps": 50000, "level": "basic"}'
```

Example: evaluate
```bash
curl -X POST http://localhost:8000/evaluate \
  -H "Content-Type: application/json" \
  -d '{"model_path": "data/models/PPO_20240101_120000.zip", "environment": "AngryBird-v0", "n_episodes": 50, "level": "basic"}'
```

Example: play
```bash
curl -X POST http://localhost:8000/play \
  -H "Content-Type: application/json" \
  -d '{"model_path": "data/models/PPO_20240101_120000.zip", "environment": "AngryBird-v0", "target": 100, "max_episodes": 100, "level": "basic"}'
```

## Claude Code Tools

Tools are exposed in backend/utils/tools.py:

- parse_goal
- train_rl_agent
- evaluate_model
- run_runtime
- generate_reward_function
- get_status
- save_checkpoint
- load_model

## Frontend

Pages:
- / (dashboard)
- /goal (goal submission)
- /train (manual training)
- /monitor (progress)
- /models (model registry)

## Project Structure

```
auga/
  backend/
    agents/
    rl/
    runtime/
    workflows/
    api/
    utils/
  frontend/
  data/
  docker/
  tests/
  config.py
  README.md
  AGENTS.md
```

## Notes

- AngryBird-v0 is a simplified Gymnasium environment.
- The system can run without LangGraph; it falls back to a sequential workflow.
- Docker sandboxing is optional but recommended.

## Troubleshooting

- If the frontend cannot reach the API, set NEXT_PUBLIC_API_URL in frontend/.env.local.
- If uvicorn fails on import, run pip install -r requirements.txt in the active venv.
- For Windows PowerShell execution policy issues with npm, run npm via cmd:
  cmd /c npm run dev
