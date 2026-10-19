"""Drop privileges after the cache volume is writable by uid 10001.

A named volume is created as root. laya-serve then runs as the unprivileged
user so the checkpoint download can persist across restarts.
"""

import os
import pathlib

UID = 10001
GID = 10001
CACHE = pathlib.Path("/home/laya/.cache/huggingface")


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    if CACHE.stat().st_uid != UID:
        for root, dirs, files in os.walk(CACHE):
            os.chown(root, UID, GID)
            for name in dirs:
                os.chown(os.path.join(root, name), UID, GID)
            for name in files:
                os.chown(os.path.join(root, name), UID, GID)

    os.setgid(GID)
    os.setuid(UID)
    os.environ["HOME"] = "/home/laya"
    os.execvp("laya-serve", ["laya-serve"])


if __name__ == "__main__":
    main()
