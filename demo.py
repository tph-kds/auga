"""
Demo script showing basic usage of the autonomous RL agent system.
Run this to verify installation and see the system in action.
"""
from backend.agents.planner import PlannerAgent
from backend.rl.trainer import RLTrainer
from backend.runtime.controller import RuntimeController
from backend.workflows.orchestration import WorkflowOrchestrator

def demo_goal_parsing():
    """Demonstrate natural language goal parsing."""
    print("\n=== Demo 1: Goal Parsing ===")

    planner = PlannerAgent()

    goals = [
        "Train an agent to balance the pole in CartPole for 200 steps",
        "Make the flappy bird fly through as many pipes as possible",
        "Maximize the score in CartPole using PPO algorithm",
    ]

    for goal in goals:
        print(f"\nInput: {goal}")
        plan = planner.parse_goal(goal)
        print(f"Parsed: {plan.goal} on {plan.game_type.value}")
        print(f"Target: {plan.target_value}, Timesteps: {plan.total_timesteps}")
        print(f"Algorithm: {plan.algorithm.value}")


def demo_training():
    """Demonstrate quick training on CartPole."""
    print("\n\n=== Demo 2: Quick Training (CartPole) ===")

    import gymnasium as gym

    # Setup
    trainer = RLTrainer()
    env = gym.make("CartPole-v1")

    # Create and train
    print("Creating PPO model...")
    trainer.create_model(env, algorithm="PPO", config={"learning_rate": 3e-4})

    print("Training for 10000 timesteps...")
    metrics = trainer.train(total_timesteps=10000)

    print(f"Training complete. Mean reward: {metrics.get('mean_reward', 'N/A')}")

    # Evaluate
    print("Evaluating...")
    results = trainer.evaluate(n_episodes=10)
    print(f"Evaluation: {results['mean_reward']:.2f} ± {results['std_reward']:.2f}")
    print(f"Success rate: {results['success_rate']:.2%}")

    # Save
    path = trainer.save_model("demo_cartpole")
    print(f"Model saved: {path}")


def demo_runtime():
    """Demonstrate runtime goal checking."""
    print("\n\n=== Demo 3: Runtime Controller ===")

    from backend.agents.planner import TrainingPlan, GameType, Algorithm

    # Quick train first
    trainer = RLTrainer()
    import gymnasium as gym
    env = gym.make("CartPole-v1")
    trainer.create_model(env, "PPO", {"learning_rate": 3e-4})
    trainer.train(total_timesteps=5000)

    # Create controller
    controller = RuntimeController(trainer=trainer)

    # Create plan
    plan = TrainingPlan(
        goal="balance",
        target_value=195.0,
        game_type=GameType.CARTPOLE,
        algorithm=Algorithm.PPO,
        total_timesteps=10000,
        reward_strategy="default",
        success_criteria="Achieve score >= 195"
    )

    print("Running runtime test (5 evaluation episodes)...")
    success, results = controller.run_until_goal(plan, max_retries=1)

    print(f"Success: {success}")
    print(f"Episodes: {results.get('episodes', 0)}")
    print(f"Best score: {results.get('best_score', 0):.2f}")


def demo_workflow():
    """Demonstrate complete workflow."""
    print("\n\n=== Demo 4: Complete Workflow ===")

    orchestrator = WorkflowOrchestrator(WorkflowConfig(max_iterations=1))

    user_input = "Train an agent to balance a pole in CartPole"
    print(f"\nUser input: {user_input}")

    result = orchestrator.run(user_input)

    print(f"\nWorkflow complete!")
    print(f"Success: {result['success']}")
    print(f"Output: {result.get('final_output', 'N/A')}")
    print(f"Iterations: {result['iteration']}")


if __name__ == "__main__":
    print("=" * 60)
    print("Autonomous RL Agent System - Demo")
    print("=" * 60)

    try:
        # Demo 1: Goal parsing (fastest)
        demo_goal_parsing()

        # Uncomment for full demos (requires more time):
        # demo_training()  # ~30 seconds
        # demo_runtime()   # ~15 seconds
        # demo_workflow()  # ~60 seconds

        print("\n\n" + "=" * 60)
        print("Demo completed!")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\nDemo interrupted by user")
    except Exception as e:
        print(f"\nDemo failed with error: {e}")
        import traceback
        traceback.print_exc()
