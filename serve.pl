#!/usr/bin/perl
use strict;
use warnings;
use IO::Socket::INET;
use File::Basename;
use POSIX qw(WNOHANG);

my $port = $ENV{PORT} || 8080;
my $root = 'C:/Users/USER/Documents/Projetos/gestescolar';

my %mime = (
    '.html'  => 'text/html; charset=utf-8',
    '.css'   => 'text/css; charset=utf-8',
    '.js'    => 'application/javascript; charset=utf-8',
    '.json'  => 'application/json',
    '.png'   => 'image/png',
    '.jpg'   => 'image/jpeg',
    '.ico'   => 'image/x-icon',
    '.svg'   => 'image/svg+xml',
    '.woff2' => 'font/woff2',
    '.woff'  => 'font/woff',
    '.ttf'   => 'font/ttf',
);

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Proto     => 'tcp',
    Listen    => 50,
    ReuseAddr => 1,
) or die "Cannot bind port $port: $!\n";

print "GestEscolar listening on http://localhost:$port/\n";
$| = 1;

while (my $client = $server->accept()) {
    my $pid = fork();
    if (!defined $pid) {
        # fork failed – handle in parent
        handle_request($client);
        $client->close();
    } elsif ($pid == 0) {
        # child process
        $server->close();
        handle_request($client);
        $client->close();
        exit 0;
    } else {
        # parent
        $client->close();
        # reap zombies
        while (waitpid(-1, WNOHANG) > 0) {}
    }
}

sub handle_request {
    my ($sock) = @_;
    $sock->autoflush(1);

    my $request_line = <$sock>;
    return unless defined $request_line;
    $request_line =~ s/\r?\n$//;

    # read remaining headers (ignore them)
    while (my $line = <$sock>) {
        $line =~ s/\r?\n$//;
        last if $line eq '';
    }

    my ($method, $path) = split /\s+/, $request_line;
    $path //= '/';
    $path =~ s/\?.*//;
    $path =~ s|^/||;
    $path ||= 'index.html';

    # decode URL encoding
    $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;

    # security: no path traversal
    $path =~ s|\.\.||g;

    my $file = "$root/$path";
    my ($body, $ct);

    if (-f $file) {
        my $ext = lc((fileparse($file, qr/\.[^.]*/))[2]);
        $ct = $mime{$ext} || 'application/octet-stream';
        open my $fh, '<:raw', $file or do {
            send_error($sock, 500); return;
        };
        local $/;
        $body = <$fh>;
        close $fh;
    } else {
        $ct   = 'text/html; charset=utf-8';
        open my $fh, '<:raw', "$root/index.html" or do {
            send_error($sock, 404); return;
        };
        local $/;
        $body = <$fh>;
        close $fh;
    }

    my $len = length($body);
    print $sock "HTTP/1.1 200 OK\r\n";
    print $sock "Content-Type: $ct\r\n";
    print $sock "Content-Length: $len\r\n";
    print $sock "Cache-Control: no-cache\r\n";
    print $sock "Connection: close\r\n";
    print $sock "\r\n";
    print $sock $body;
}

sub send_error {
    my ($sock, $code) = @_;
    print $sock "HTTP/1.1 $code Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
}
