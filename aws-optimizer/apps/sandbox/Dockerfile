# Cloudflare Sandbox base image with AWS CLI v2
FROM docker.io/cloudflare/sandbox:0.3.3

# Install AWS CLI v2 dependencies and CLI in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    unzip \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip -q awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && mkdir -p /root/.aws

# Verify installation
RUN aws --version
