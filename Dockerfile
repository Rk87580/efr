FROM ubuntu:20.04

WORKDIR /app

# only required runtime libraries
RUN apt-get update && \
    apt-get install -y \
        libstdc++6 \
        libssl1.1 \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY . .

# make binaries executable
RUN chmod +x /app/EFR_NO_2.7.3_install_linux64/run.sh && \
    chmod +x /app/EFR_NO_2.7.3_install_linux64/app/node

WORKDIR /app/EFR_NO_2.7.3_install_linux64

CMD ["./run.sh"]
