import os

api_key = None
dotenv_error = None

# Option 1: Google Colab Secrets
try:
    from google.colab import userdata

    api_key = userdata.get("OPENAI_API_KEY")
except ImportError:
    pass

# Option 2: local environment variable or .env file
if not api_key:
    api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    try:
        from dotenv import load_dotenv

        load_dotenv("../.env")
        api_key = os.getenv("OPENAI_API_KEY")
    except ImportError as exc:
        dotenv_error = exc

if not api_key:
    message = (
        "OPENAI_API_KEY was not found. Add it to Google Colab Secrets "
        "or create a local .env file with OPENAI_API_KEY=..."
    )
    if dotenv_error:
        message += " Install python-dotenv first: pip install python-dotenv"
    raise ValueError(message)

os.environ["OPENAI_API_KEY"] = api_key