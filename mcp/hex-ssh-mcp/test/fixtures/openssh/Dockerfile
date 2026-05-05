FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -d /home/tester -s /bin/bash tester \
    && mkdir -p /home/tester/.ssh /run/sshd /tmp/hex-ssh-download \
    && printf 'remote log from openssh\n' > /tmp/hex-ssh-download/app.log \
    && passwd -d tester \
    && chown -R tester:tester /home/tester /tmp/hex-ssh-download

COPY generated/client_ed25519.pub /home/tester/.ssh/authorized_keys
COPY generated/ssh_host_ed25519_key /etc/ssh/ssh_host_ed25519_key
COPY generated/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ed25519_key.pub
COPY sshd_config /etc/ssh/sshd_config

RUN chmod 700 /home/tester/.ssh \
    && chmod 600 /home/tester/.ssh/authorized_keys /etc/ssh/ssh_host_ed25519_key \
    && chmod 644 /etc/ssh/ssh_host_ed25519_key.pub \
    && chown -R tester:tester /home/tester/.ssh

EXPOSE 2222

CMD ["/usr/sbin/sshd", "-D", "-e", "-f", "/etc/ssh/sshd_config"]
