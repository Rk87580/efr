FROM ubuntu:20.04

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl bash ca-certificates libssl1.1 libstdc++6

# Install Node 10 (required for boot.node)
RUN curl -fsSL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y nodejs

COPY . .

RUN chmod +x EFR_NO_2.7.3_install_linux64/run.sh

WORKDIR /app/EFR_NO_2.7.3_install_linux64

CMD ["./run.sh"]
