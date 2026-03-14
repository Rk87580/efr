FROM ubuntu:20.04

WORKDIR /app

# install required libs
RUN apt-get update && \
    apt-get install -y \
    libstdc++6 \
    libgcc1 \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# copy project
COPY . .

# permissions
RUN chmod +x EFR_NO_2.7.3_install_linux64/run.sh

WORKDIR /app/EFR_NO_2.7.3_install_linux64

CMD ["./run.sh"]
