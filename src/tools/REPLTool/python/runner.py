"""
LegnaCode Python Runner — persistent NDJSON kernel for code execution.
Self-contained, no external dependencies beyond stdlib.

Protocol:
  stdin:  {"type": "execute", "id": "msg_1", "code": "print('hi')"}
  stdout: {"type": "result", "id": "msg_1", "text": "hi\n"}
         {"type": "error", "id": "msg_1", "traceback": "..."}
         {"type": "display", "id": "msg_1", "data": {"image/png": "base64..."}}
"""

import sys
import json
import traceback
import io
import os
from contextlib import redirect_stdout, redirect_stderr

# Signal ready
sys.stdout.write(json.dumps({"type": "result", "id": "ready", "text": "kernel ready"}) + "\n")
sys.stdout.flush()

# Persistent namespace for user code
_namespace = {"__name__": "__main__", "__builtins__": __builtins__}


def execute(msg_id: str, code: str):
    """Execute code and return results via NDJSON."""
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    try:
        # Try eval first (expression → return value)
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            try:
                result = eval(compile(code, "<repl>", "eval"), _namespace)
                if result is not None:
                    # Check for rich display (pandas, PIL, etc.)
                    display_data = try_rich_display(result)
                    if display_data:
                        send({"type": "display", "id": msg_id, "data": display_data})
                    else:
                        stdout_capture.write(repr(result) + "\n")
            except SyntaxError:
                # Not an expression, execute as statements
                exec(compile(code, "<repl>", "exec"), _namespace)

    except Exception:
        tb = traceback.format_exc()
        stderr_out = stderr_capture.getvalue()
        send({"type": "error", "id": msg_id, "traceback": tb, "text": stderr_out})
        return

    stdout_out = stdout_capture.getvalue()
    stderr_out = stderr_capture.getvalue()

    if stderr_out:
        send({"type": "stderr", "id": msg_id, "text": stderr_out})
    if stdout_out:
        send({"type": "result", "id": msg_id, "text": stdout_out})
    elif not stderr_out:
        send({"type": "result", "id": msg_id, "text": ""})


def try_rich_display(obj):
    """Try to produce rich display data (image, HTML, etc.) for an object."""
    display_data = {}

    # pandas DataFrame
    try:
        import pandas as pd
        if isinstance(obj, (pd.DataFrame, pd.Series)):
            display_data["text/plain"] = repr(obj)
            display_data["text/html"] = obj.to_html(max_rows=50)
            return display_data
    except ImportError:
        pass

    # PIL Image
    try:
        from PIL import Image
        if isinstance(obj, Image.Image):
            import base64
            buf = io.BytesIO()
            obj.save(buf, format="PNG")
            display_data["image/png"] = base64.b64encode(buf.getvalue()).decode()
            return display_data
    except ImportError:
        pass

    # matplotlib figure
    try:
        import matplotlib.pyplot as plt
        import matplotlib.figure
        if isinstance(obj, matplotlib.figure.Figure):
            import base64
            buf = io.BytesIO()
            obj.savefig(buf, format="png", bbox_inches="tight")
            buf.seek(0)
            display_data["image/png"] = base64.b64encode(buf.getvalue()).decode()
            plt.close(obj)
            return display_data
    except ImportError:
        pass

    return None


def send(msg: dict):
    """Send a message to stdout as NDJSON."""
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main_loop():
    """Main REPL loop — reads NDJSON from stdin, executes, responds."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        msg_type = msg.get("type", "")
        msg_id = msg.get("id", "unknown")

        if msg_type == "execute":
            code = msg.get("code", "")
            execute(msg_id, code)
        elif msg_type == "exit":
            send({"type": "result", "id": msg_id, "text": "bye"})
            break
        else:
            send({"type": "error", "id": msg_id, "traceback": f"Unknown message type: {msg_type}"})


if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        pass
    except BrokenPipeError:
        pass
