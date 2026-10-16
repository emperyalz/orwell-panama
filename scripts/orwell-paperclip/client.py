#!/usr/bin/env python3
"""Paperclip process adapter: stream real root-controller observations."""
import argparse
import json
import os
import socket
import sys

MAX_LINE = 8192
SOCKET = "/run/orwell-paperclip/control.sock"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--role", choices=("codex", "claude", "orion"), required=True)
    parser.add_argument("--item-key")
    parser.add_argument("--socket", default=SOCKET)
    args = parser.parse_args()
    # These identify a mirrored issue; neither is trusted as execution authority.
    item = args.item_key or os.environ.get("PAPERCLIP_ISSUE_ID") or os.environ.get("PAPERCLIP_TASK_ID")
    request = {"role": args.role}
    if item:
        request["itemKey"] = item
    terminal = False
    successful = False
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
            conn.settimeout(13 * 60 + 30)
            conn.connect(args.socket)
            conn.sendall(json.dumps(request, separators=(",", ":")).encode() + b"\n")
            with conn.makefile("rb") as stream:
                for _ in range(1000):
                    line = stream.readline(MAX_LINE + 1)
                    if not line:
                        break
                    if len(line) > MAX_LINE or not line.endswith(b"\n"):
                        raise ValueError("Bounded bridge response required")
                    response = json.loads(line)
                    if not isinstance(response, dict) or response.get("status") not in {"observed", "complete", "noop", "held", "failed", "error"}:
                        raise ValueError("Invalid bridge response")
                    # No CLI/provider is invoked and no Paperclip token is read or sent.
                    print(json.dumps(response, ensure_ascii=True, separators=(",", ":")), flush=True)
                    if response["status"] != "observed":
                        terminal = True
                        successful = response["status"] in {"complete", "noop"}
                        break
    except (OSError, ValueError):
        print('{"status":"failed","reason":"Guarded controller connection failed"}', flush=True)
        return 1
    return 0 if terminal and successful else 1


if __name__ == "__main__":
    sys.exit(main())
