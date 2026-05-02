"""
Angry Birds RL Training Demo
Showcases the autonomous agent learning to play Angry Birds.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agents.planner import PlannerAgent
from backend.rl.trainer import RLTrainer
from backend.runtime.controller import RuntimeController
from backend.agents.reward_generator import RewardGenerator
from backend.rl.angry_birds_env import AngryBirdsEnv, make_angry_birds

def demo_goal_parsing():
    """Show how natural language becomes training plan."""
    print("\n" + "="*60)
    print("DEMO 1: Natural Language Goal Parsing")
    print("="*60)

    planner = PlannerAgent()

    goals = [
        "Destroy all pigs in Angry Birds",
        "Train an agent to maximize score in Angry Birds",
        "Clear the level using only one bird",
        "Achieve 5000 points with perfect accuracy",
    ]

    for i, goal in enumerate(goals, 1):
        print(f"\n[{i}] Input: \"{goal}\"")
        plan = planner.parse_goal(goal)
        print(f"    → Game: {plan.game_type.value}")
        print(f"    → Goal: {plan.goal}")
        print(f"    → Target: {plan.target_value}")
        print(f"    → Algorithm: {plan.algorithm.value}")
        print(f"    → Timesteps: {plan.total_timesteps:,}")


def demo_reward_generation():
    """Show custom reward function creation."""
    print("\n" + "="*60)
    print("DEMO 2: Angry Birds Reward Design")
    print("="*60)

    planner = PlannerAgent()
    reward_gen = RewardGenerator()

    goals = [
        ("destroy_pigs", "Destroy all pigs"),
        ("maximize_score", "Maximize score"),
        ("minimize_birds", "Use fewest birds"),
    ]

    for goal_type, description in goals:
        plan = planner.parse_goal(f"Train for {description} in Angry Birds")
        reward_fn = reward_gen.generate_reward_fn(plan)

        print(f"\n{description.upper()}")
        print(f"  Goal type: {goal_type}")
        print(f"  Reward function: {reward_fn.__name__}")

        # Test with dummy state
        import numpy as np
        state = np.array([0.5, 0.5, 5, -3, 0.1, 0.6, 0.5, 0.8])  # normalized values
        reward = reward_fn(state, 0, state, False, {'pigs_killed': 1, 'score': 100})
        print(f"  Sample reward (1 pig killed): {reward:.2f}")


def demo_quick_training():
    """Show minimal training to verify environment works."""
    print("\n" + "="*60)
    print("DEMO 3: Quick Training (1000 steps)")
    print("="*60)

    print("\nCreating Angry Birds environment...")
    env = make_angry_birds(level='basic')
    print(f"Observation space: {env.observation_space}")
    print(f"Action space: {env.action_space}")

    trainer = RLTrainer()
    print("\nCreating PPO model...")
    success, msg = trainer.create_model(env, algorithm='PPO', config={
        'learning_rate': 1e-3,
        'n_steps': 1024,
    })
    print(f"  {msg}")

    print("\nTraining for 1000 timesteps...")
    metrics = trainer.train(total_timesteps=1000)
    print(f"  Completed {metrics['total_timesteps']} timesteps")
    print(f"  Mean reward: {metrics.get('mean_reward', 'N/A')}")

    # Save model
    path = trainer.save_model("angry_birds_demo")
    print(f"\nModel saved: {path}")


def demo_runtime_execution():
    """Show agent playing Angry Birds."""
    print("\n" + "="*60)
    print("DEMO 4: Runtime Execution")
    print("="*60)

    # Load or create quick model
    trainer = RLTrainer()
    env = make_angry_birds(level='basic')

    print("\nCreating quick model (untrained)...")
    trainer.create_model(env, 'PPO', {'learning_rate': 1e-3})
    trainer.train(total_timesteps=500)  # Minimal training

    controller = RuntimeController(trainer=trainer)

    from backend.agents.planner import TrainingPlan, GameType, Algorithm
    plan = TrainingPlan(
        goal="destroy_pigs",
        target_value=2.0,  # Kill 2 pigs
        game_type=GameType.ANGRY_BIRDS,
        algorithm=Algorithm.PPO,
        total_timesteps=10000,
        reward_strategy="pig_kill + damage",
        success_criteria="Kill at least 2 pigs per episode"
    )

    print(f"\nRunning 5 evaluation episodes...")
    print(f"Goal: {plan.success_criteria}")

    success, results = controller.run_until_goal(plan, max_retries=1)

    print(f"\nResults:")
    print(f"  Success: {success}")
    print(f"  Episodes: {results.get('episodes', 0)}")
    print(f"  Best score: {results.get('best_score', 0):.1f}")
    print(f"  Time: {results.get('time_elapsed', 0):.2f}s")


def demo_full_workflow():
    """Show complete autonomous workflow."""
    print("\n" + "="*60)
    print("DEMO 5: Full Autonomous Workflow (1 iteration)")
    print("="*60)

    from backend.workflows.orchestration import WorkflowOrchestrator, WorkflowConfig

    orchestrator = WorkflowOrchestrator(WorkflowConfig(
        max_iterations=1,  # Only 1 iteration for demo
        enable_curriculum=True
    ))

    user_input = "Train an Angry Birds agent to destroy all pigs in the basic level"
    print(f"\nUser goal: \"{user_input}\"")
    print("\nStarting autonomous workflow...")

    result = orchestrator.run(user_input)

    print(f"\n{'='*60}")
    print("WORKFLOW COMPLETE")
    print(f"{'='*60}")
    print(f"Success: {result['success']}")
    print(f"Output: {result.get('final_output', 'N/A')}")
    print(f"Total iterations: {result['iteration']}")

    if 'runtime_results' in result:
        runtime = result['runtime_results']
        print(f"Episodes: {runtime.get('episodes', 0)}")
        print(f"Best score: {runtime.get('best_score', 0):.1f}")


def main():
    print("\n" + "="*60)
    print("ANGRY BIRDS RL TRAINING DEMO")
    print("="*60)
    print("\nThis demo showcases the autonomous RL agent")
    print("system focused on Angry Birds gameplay.")

    try:
        # Demo 1: Goal parsing (fastest)
        demo_goal_parsing()

        # Demo 2: Reward generation
        demo_reward_generation()

        # Demo 3: Quick training
        print("\n\n" + "="*60)
        response = input("\nProceed with training demos? (y/n): ").lower().strip()
        if response == 'y':
            demo_quick_training()

            # Demo 4: Runtime
            demo_runtime_execution()

            # Demo 5: Full workflow (slower)
            print("\n\n" + "="*60)
            response = input("Full workflow demo (2-3 minutes)? (y/n): ").lower().strip()
            if response == 'y':
                demo_full_workflow()

        print("\n\n" + "="*60)
        print("DEMO COMPLETE!")
        print("="*60)
        print("\nNext steps:")
        print("  1. pip install -r requirements.txt")
        print("  2. npm install && npm run dev  (in frontend/)")
        print("  3. uvicorn backend.api.main:app --reload")
        print("  4. Open http://localhost:3000")
        print()

    except KeyboardInterrupt:
        print("\nDemo interrupted")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
