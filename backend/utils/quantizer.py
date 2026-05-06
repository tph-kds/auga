"""
Model Quantization & Compression Utility.
Implements Section 12 of GAME_RL_AGENTS.md:
- ONNX model export for PyTorch/Stable-Baselines3 models.
- INT8 Post-Training Quantization (PTQ) helpers.
- FP16 conversion functions for lightweight low-VRAM inference.
"""
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class ModelQuantizer:
    """
    Manages model post-processing, export, and quantization
    for low-VRAM (<4GB) CPU/GPU inference.
    """

    @staticmethod
    def export_to_onnx(model_path: str, output_path: str, input_dim: int) -> bool:
        """
        Exports a Stable-Baselines3 PyTorch policy model to ONNX.
        Allows fast, low-footprint inference via ONNX Runtime on CPU or GPU.
        """
        try:
            import torch
            from stable_baselines3 import PPO, DQN, A2C

            # Determine algorithm from path
            algo_name = "PPO"
            if "dqn" in model_path.lower():
                algo_name = "DQN"
            elif "a2c" in model_path.lower():
                algo_name = "A2C"

            # Load model
            logger.info(f"Loading model from {model_path} for ONNX export...")
            algo_classes = {"PPO": PPO, "DQN": DQN, "A2C": A2C}
            model = algo_classes[algo_name].load(model_path, device="cpu")

            # Extract PyTorch policy
            policy = model.policy
            policy.eval()

            # Dummy input matching observation space
            dummy_input = torch.randn(1, input_dim)

            # Export
            logger.info(f"Exporting PyTorch policy to {output_path}...")
            torch.onnx.export(
                policy,
                dummy_input,
                output_path,
                export_params=True,
                opset_version=12,
                do_constant_folding=True,
                input_names=['input'],
                output_names=['output'],
                dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
            )
            logger.info("ONNX export completed successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to export to ONNX: {e}")
            return False

    @staticmethod
    def quantize_to_int8(onnx_model_path: str, output_path: str) -> bool:
        """
        Quantizes an ONNX model to INT8 using Post-Training Quantization (PTQ).
        Significantly reduces memory footprint and increases execution speed.
        """
        try:
            import onnx
            from onnxruntime.quantization import quantize_dynamic, QuantType

            logger.info(f"Quantizing ONNX model {onnx_model_path} to INT8 dynamic...")
            quantize_dynamic(
                model_input=onnx_model_path,
                model_output=output_path,
                weight_type=QuantType.QUInt8
            )
            logger.info(f"INT8 Quantized model saved to {output_path}")
            return True
        except ImportError:
            logger.warning("onnxruntime.quantization not available. Skipping PTQ quantization.")
            return False
        except Exception as e:
            logger.error(f"Quantization failed: {e}")
            return False

    @staticmethod
    def convert_to_fp16(model_path: str, output_path: str) -> bool:
        """
        Converts model weights to half-precision (FP16) for modern hardware inference.
        Cuts memory footprint in half.
        """
        try:
            import torch
            state_dict = torch.load(model_path, map_location="cpu")
            if "state_dict" in state_dict:
                for k, v in state_dict["state_dict"].items():
                    if isinstance(v, torch.Tensor) and torch.is_floating_point(v):
                        state_dict["state_dict"][k] = v.half()
            
            torch.save(state_dict, output_path)
            logger.info(f"Successfully saved FP16 model weights to {output_path}")
            return True
        except Exception as e:
            logger.error(f"FP16 conversion failed: {e}")
            return False
