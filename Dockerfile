FROM ubuntu:20.04

WORKDIR /app

# Install dependencies + Node 10 manually
RUN apt-get update && \
    apt-get install -y \
        curl \
        bash \
        unzip \
        libstdc++6 \
        libssl1.1 \
        ca-certificates && \
    curl -fsSL https://nodejs.org/dist/v10.24.1/node-v10.24.1-linux-x64.tar.xz -o node.tar.xz && \
    tar -xJf node.tar.xz && \
    mv node-v10.24.1-linux-x64 /usr/local/node && \
    ln -s /usr/local/node/bin/node /usr/bin/node && \
    ln -s /usr/local/node/bin/npm /usr/bin/npm && \
    rm node.tar.xz

# Copy project
COPY . .

WORKDIR /app/EFR_NO_2.7.3_install_linux64

# permissions
RUN chmod +x run.sh

# run installer using system node
RUN node app/install.js

CMD ["./run.sh"]
