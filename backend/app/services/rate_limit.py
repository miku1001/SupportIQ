import time
from collections import defaultdict, deque

#20 req per 60 sec
WINDOW_SECONDS = 60
MAX_REQ = 20

_requests = defaultdict(deque)

def allow(key: str, max_req: int = MAX_REQ, window_seconds: int = WINDOW_SECONDS) -> bool:
  now = time.time()
  q = _requests[key]

  while q and (now - q[0]) > window_seconds:
    q.popleft()

  if len(q) >=max_req:
    return False

  q.append(now)
  return True