#!/bin/bash
# Restarts cloudflared only when the public site is really unreachable.
# Probes the .com domain. It used to probe shubhanmehrotra.in, which does not
# exist, so the probe always failed and the tunnel was restarted every 5 min.
URL="https://shubhanmehrotra.com"
probe() { curl -sf --max-time 10 "$URL" > /dev/null 2>&1; }
while true; do
    sleep 300
    if ! probe; then
        sleep 20
        if ! probe; then
            echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) site unreachable twice, restarting cloudflared" >> /var/log/watchdog.log
            supervisorctl restart cloudflared >> /var/log/watchdog.log 2>&1
        fi
    fi
done
