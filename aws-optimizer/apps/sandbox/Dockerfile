# Cloudflare Sandbox base image with AWS CLI v2 and Claude Code CLI (Bedrock)
FROM docker.io/cloudflare/sandbox:0.3.3

# Install AWS CLI v2 + Node 20 + Claude Code CLI in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ca-certificates \
    gnupg \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip -q awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && ln -sf "$(command -v claude)" /usr/local/bin/claude \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && mkdir -p /root/.aws

# Non-root user for Claude Code (refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash -u 1000 sandbox

# Verify installations
RUN aws --version && node --version && claude --version
