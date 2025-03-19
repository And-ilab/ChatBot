import torch
from peft import PeftModel, PeftConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, GenerationConfig
import os

class NeuralModel:
    def __init__(
        self,
        model_name="IlyaGusev/saiga_mistral_7b",
        message_template="<s>{role}\n{content}</s>",
        response_template="<s>bot\n",
        system_prompt="Ты — чат-бот, русскоязычный автоматический ассистент для работников банка. Ты разговариваешь с людьми и помогаешь им.",
        offload_folder="./offload"
    ):
        self.model_name = model_name
        self.message_template = message_template
        self.response_template = response_template
        self.system_prompt = system_prompt
        self.offload_folder = offload_folder

        # Загружаем конфигурацию модели
        self.config = PeftConfig.from_pretrained(self.model_name)

        # Загружаем базовую модель на CPU
        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.base_model_name_or_path,
            torch_dtype=torch.float16,  # Используем float16 для экономии памяти
            device_map=None  # Это гарантирует, что модель будет загружена на CPU
        )

        # Загружаем PEFT-модель на CPU
        self.model = PeftModel.from_pretrained(
            self.model,
            self.model_name,
            torch_dtype=torch.float16,
            use_safetensors=False  # Отключаем использование safetensors
        )
        self.model.eval()

        # Загружаем токенизатор и конфигурацию генерации
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=False)
        self.generation_config = GenerationConfig.from_pretrained(self.model_name)

    def generate_response(self, user_input):
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_input}
        ]
        prompt = ""
        for message in messages:
            prompt += self.message_template.format(**message)
        prompt += self.response_template

        # Токенизируем входные данные
        data = self.tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
        data = {k: v.to(self.model.device) for k, v in data.items()}

        # Генерируем ответ
        output_ids = self.model.generate(
            **data,
            generation_config=self.generation_config
        )[0]
        output_ids = output_ids[len(data["input_ids"][0]):]
        output = self.tokenizer.decode(output_ids, skip_special_tokens=True)
        return output.strip()


# Создаем экземпляр модели
nn_model_instance = NeuralModel()
