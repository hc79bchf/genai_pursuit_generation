import os
import logging
from docx import Document
from pypdf import PdfReader

logger = logging.getLogger(__name__)

class FileService:
    @staticmethod
    def extract_text(file_path: str, file_type: str = None) -> str:
        """
        Extract text from a file based on its extension or provided file_type.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == ".docx" or file_type == "docx":
                return FileService._extract_from_docx(file_path)
            elif ext == ".pdf" or file_type == "pdf":
                return FileService._extract_from_pdf(file_path)
            elif ext == ".txt" or file_type == "txt":
                return FileService._extract_from_txt(file_path)
            else:
                # Fallback to text extraction for unknown types, or return empty
                logger.warning(f"Unsupported file type for extraction: {ext}")
                return ""
        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            raise e

    @staticmethod
    def _extract_from_docx(file_path: str) -> str:
        doc = Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        return "\n".join(full_text)

    @staticmethod
    def _extract_from_pdf(file_path: str) -> str:
        reader = PdfReader(file_path)
        full_text = []
        for page in reader.pages:
            full_text.append(page.extract_text())
        return "\n".join(full_text)

    @staticmethod
    def _extract_from_txt(file_path: str) -> str:
        with open(file_path, "r", errors="replace") as f:
            return f.read()
