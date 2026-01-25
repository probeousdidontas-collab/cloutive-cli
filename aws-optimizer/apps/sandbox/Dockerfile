# Cloudflare Sandbox base image with AWS CLI v2
FROM docker.io/cloudflare/sandbox:0.3.3

# Install AWS CLI v2 dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    less \
    groff \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Create AWS config directory
RUN mkdir -p /root/.aws

# Verify installation
RUN aws --version
