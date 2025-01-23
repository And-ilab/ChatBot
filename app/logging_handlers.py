from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
import os

LOG_DATE_FORMAT = datetime.now().strftime('%Y-%m-%d')  # Ф

class CustomTimedRotatingFileHandler(TimedRotatingFileHandler):
    def __init__(self, filename, *args, **kwargs):
        base_filename, file_extension = os.path.splitext(filename)
        self.base_filename = base_filename
        self.file_extension = file_extension
        super().__init__(filename, *args, **kwargs)

    def _open(self):
        self.baseFilename = f"{self.base_filename}_{datetime.now().strftime('%Y-%m-%d')}{self.file_extension}"
        return super()._open()