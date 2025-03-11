from django.apps import AppConfig
from models_ai.model_handler import ModelHandler
from chat_user.questions import questions_list
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from huggingface_hub import snapshot_download


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_user'

    def ready(self):
        from django.conf import settings

        if not hasattr(settings, 'MODEL_HANDLER'):
            settings.MODEL_HANDLER = ModelHandler(questions_list)

        local_model_path = "models_ai/h2ogpt-4096-llama2-7b-chat"

        snapshot_download(
            repo_id="h2oai/h2ogpt-4096-llama2-7b-chat",
            local_dir=local_model_path,
            resume_download=True,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(
            local_model_path,
            use_fast=False,
            padding_side="left",
            trust_remote_code=True,
            legacy=True,
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            local_model_path,
            torch_dtype="auto",
            device_map="auto",
            trust_remote_code=True,
        )

        self.generate_text = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
        )