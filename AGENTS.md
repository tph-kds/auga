# Agent Architecture Documentation

## Auga RLAI Overview

This document describes the Auga RLAI multi-agent architecture. Angry Birds is the primary example environment, with support for additional Gymnasium tasks.

## System Overview

This system implements a **fully autonomous goal-driven RL agent** with a multi-agent architecture and tool-based execution. Angry Birds is the primary example environment.

## Primary Focus: Angry Birds

The system is designed to train agents that can play **Angry Birds** effectively, with the following capabilities:

- **Physics Understanding**: Gravity, momentum, collision, structural destruction
- **Strategic Planning**: Which bird to use, where to aim, how much power
- **Goal Achievement**: From simple "destroy pigs" to complex "3-star optimization"
- **Progressive Learning**: Curriculum from basic to advanced levels

### Primary Environment

**AngryBird-v0** (Custom Gymnasium environment)

| Feature | Description |
|---------|-------------|
| **Physics** | Simplified realistic 2D physics |
| **Birds** | Red, Yellow (fast), Blue (split), Black (explosive) |
| **Materials** | Wood, Stone, Ice with different strengths |
| **Levels** | Basic, Medium, Advanced |
| **Goal Types** | Destroy pigs, Maximize score, Minimize birds, Precision |

### Secondary Environments

- **CartPole-v1** - Classic control
- **FlappyBird-v0** - Procedural generation

### 1. Planner Agent (`backend/agents/planner.PlannerAgent`)

**Role**: Goal decomposition and task planning

**Input**: Natural language goal description (e.g., "Destroy all pigs in Angry Birds")

**Output**: Structured `TrainingPlan` with:
- Goal type (destroy_pigs, maximize_score, minimize_birds, precision)
- Target value (number of pigs, score threshold, etc.)
- Selected environment (AngryBird-v0)
- Algorithm choice (PPO, A2C, DQN)
- Hyperparameters
- Success criteria

**Algorithm**:
- Pattern matching for Angry Birds-specific phrases
- Environment-specific defaults for physics-based gameplay
- Algorithm selection based on task complexity
- Timestep estimation based on level difficulty

**Skills**:
- `parse_goal(text)` → TrainingPlan
- `refine_plan(plan, feedback)` → TrainingPlan
- `suggest_alternatives(plan)` → List[TrainingPlan]

---

### 2. Reward Generator Agent (`backend/agents.reward_generator.RewardGenerator`)

**Role**: Reward function design and shaping for Angry Birds

**Input**: TrainingPlan + environment state

**Output**: Callable reward function `(state, action, next_state, done, info) → float`

**Strategies**:
- **Destroy Pigs**: Pig kill bonuses (50pts), level clear bonus (100pts)
- **Maximize Score**: Score scaling, structural damage reward
- **Minimize Birds**: Bird conservation bonus, efficiency rewards
- **Precision**: Accuracy to target center, trajectory rewards

**Skills**:
- `generate_reward_fn(plan)` → Callable
- `create_milestone_rewards(plan)` → Dict[threshold, bonus]
- `progressive_curriculum(current, target)` → (advance, next_config)
- `adapt_reward_weights(performance, target)` → RewardConfig
- `suggest_reward_improvements(plan, metrics)` → Dict

**Skills**:
- `generate_reward_fn(plan)` → Callable
- `create_milestone_rewards(plan)` → Dict[threshold, bonus]
- `progressive_curriculum(current, target)` → (advance, next_config)
- `adapt_reward_weights(performance, target)` → RewardConfig
- `suggest_reward_improvements(plan, metrics)` → Dict

---

### 3. RL Trainer Agent (`backend.rl.trainer.RLTrainer`)

**Role**: Model training and evaluation

**Input**: Environment, algorithm, hyperparameters

**Output**: Trained model + metrics

**Supported Algorithms**:
- PPO (default)
- A2C
- DQN

**Skills**:
- `create_model(env, algorithm, config)` → (success, message)
- `train(timesteps)` → Dict[metrics]
- `evaluate(episodes)` → Dict[results]
- `save_model(filename)` → path
- `load_model(path)` → bool

**Callbacks**:
- `MetricsCallback`: Tracks episode rewards/lengths
- `EvalCallback`: Periodic evaluation
- Hooks: `before_train_hook`, `after_train_hook`

---

### 4. Runtime Controller Agent (`backend.runtime.controller.RuntimeController`)

**Role**: Game execution and goal monitoring

**Input**: Trained model + target

**Output**: Success/failure + performance metrics

**Logic**:
1. Run episodes in environment
2. Monitor score/progress
3. Compare to target
4. Track consecutive successes
5. Decide when goal achieved
6. Implement retry logic

**Skills**:
- `play_episode(render)` → EpisodeResult
- `evaluate(n_episodes)` → EvaluationResult
- `run_until_goal(plan)` → (success, results)
- `get_progress_stats()` → Dict

**Config**:
- `max_episodes`: 1000
- `success_threshold`: 0.9 (90% success rate)
- `consecutive_successes_required`: 10
- `retry_limit`: 3

---

### 5. Orchestrator Agent (`backend.workflows.orchestration.WorkflowOrchestrator`)

**Role**: Workflow coordination and state management

**Input**: User goal

**Output**: Workflow result

**Uses LangGraph State Machine**:
```
User Input → Parse Goal → Create Env → Train → Eval → Run Runtime → Check Result
                                                              ↖_retry______↙
```

**State**: `WorkflowState` (TypedDict) flows through nodes

**Skills**:
- `run(user_input)` → FinalState
- `get_status()` → Dict
- `node_*()` functions for each workflow stage

---

## Claude Code Tool Mapping

| Component | Tool Name | Description |
|-----------|-----------|-------------|
| Planner | `parse_goal` | Parse natural language |
| Trainer | `train_rl_agent` | Train model |
| Evaluator | `evaluate_model` | Evaluate performance |
| Runtime | `run_runtime` | Execute until goal |
| RewardGen | `generate_reward_function` | Create reward fn |
| Memory | `save_checkpoint`, `load_model` | Persistence |
| System | `get_status` | System status |

All tools defined in `backend/utils/tools.py` with JSON schema.

---

## Memory System

**SQLite Database** (`data/memory/memory.db`):

### Tables:
- `plans`: Training plans
- `experiments`: Experiment results
- `model_registry`: Trained model catalog
- `logs`: System logs
- `performance_history`: Per-episode metrics
- `hyperparam_trials`: Hyperparameter tuning

**Purpose**:
- Track experiments
- Store best hyperparameters
- Enable model reuse
- Audit trail

---

## Safety & Validation

### Validation Levels
1. **Permissive**: Basic checks
2. **Standard**: Full validation (default)
3. **Strict**: Maximum security

### Checks:
- Dangerous patterns (`__import__`, `eval`, etc.)
- Script tags
- Unicode tricks
- Path traversal
- Config bounds

### Hooks:
- `before_train_hook(config)`: Validate config
- `after_train_hook(metrics)`: Log results
- `before_eval_hook(path)`: Validate model path
- `before_tool_call(name, args)`: Tool safety
- `after_tool_call(name, result)`: Post-execution

---

## Docker Sandbox

**Image**: `rl-sandbox:latest`

**Features**:
- Minimal Python 3.11 image
- RL dependencies preinstalled
- Non-root user (`rluser`)
- Read-only filesystem
- Resource limits (CPU, memory)
- Network disabled
- Timeout enforcement

**Usage**:
```python
sandbox = DockerSandbox()
result = sandbox.run_training_job(job_id="test", script_path="train.py")
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | API info |
| `/goal` | POST | Submit natural language goal (async) |
| `/status/{id}` | GET | Check workflow status |
| `/train` | POST | Synchronous training |
| `/evaluate` | POST | Evaluate model |
| `/play` | POST | Run until goal |
| `/tools` | GET | List Claude Code tools |
| `/tools/execute` | POST | Execute tool |
| `/plans` | GET | List recent plans |
| `/models` | GET | List saved models |

---

## Configuration

**File**: `config.py`

**Sections**:
- `DatabaseConfig`
- `TrainerConfig`
- `ControllerConfig`
- `SafetyConfig`
- `APIConfig`
- `SystemConfig`

**Env Vars**:
- `LOG_LEVEL`
- `SANDBOX_TIMEOUT`
- `PYTHONPATH`

---

## Quick Start Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start API
uvicorn backend.api.main:app --reload

# 3. Submit goal
curl -X POST http://localhost:8000/goal \
  -d '{"user_input": "Balance CartPole pole"}'

# 4. Check status
curl http://localhost:8000/status/{workflow_id}

# 5. Run demo
python demo.py

# 6. Run tests
python runtests.py --all
```

---

## Data Flow

```
User Input
   ↓
Planner → TrainingPlan
   ↓
Reward Generator → Reward Function
   ↓
Trainer → Trained Model
   ↓
Controller → Evaluation Results
   ↓
Orchestrator → Success/Failure
   ↓
Memory System (persist)
```

---

## Extending the System

### Add New Environment:
1. Create wrapper in `backend/rl/environments.py`
2. Add to `GameType` enum in planner
3. Add pattern in `ENVIRONMENT_PATTERNS`
4. Implement reward in `RewardGenerator._*_reward()`
5. Add hyperparameter defaults

### Add New Algorithm:
1. Add import in `backend/rl/trainer.py`
2. Add to `ALGORITHMS` dict
3. Define config in `default_configs`
4. Support in trainer methods

### Add New Tool:
1. Define schema in `TOOL_SCHEMAS`
2. Implement `_tool_<name>()` in `ToolRegistry`
3. Register in `_register_tools()`
4. Add API endpoint if needed

---

## Monitoring & Observability

- **Logs**: `data/logs/` + SQLite `logs` table
- **Metrics**: Training metrics stored with experiments
- **Models**: Registry via `model_registry` table
- **Performance**: `performance_history` tracks every episode

---

## Error Handling

- **Validation failures**: Return ValidationResult with severity
- **Training failures**: Caught, logged, stored in experiment record
- **API errors**: HTTPException with descriptive messages
- **Workflow retries**: Automatic retry up to limit with refined plan

---

## Scaling Considerations

- **Ray** can be added for distributed training
- **Celery** (docker-compose.yml) for async job queue
- **MLflow** for experiment tracking
- **Prometheus + Grafana** for monitoring
- **Multiple GPU** support via `CUDA_VISIBLE_DEVICES`

---

## Development Workflow

```bash
# 1. Make changes
# 2. Run tests
python runtests.py --all

# 3. Check lint
black backend/
isort backend/
flake8 backend/

# 4. Test API
uvicorn backend.api.main:app --reload

# 5. Try curl commands
# 6. Commit with meaningful message
```

---

## Key Design Decisions

1. **LangGraph for orchestration**: Stateful workflow with persistence
2. **Tool-based**: Claude Code compatibility from ground up
3. **SQLite for memory**: Simple, embedded, reliable
4. **Modular agents**: Separated concerns (Planner, Trainer, etc.)
5. **Safe by default**: Sandbox + validation mandatory
6. **Configurable**: Centralized config object
7. **Observable**: Extensive logging and metrics
