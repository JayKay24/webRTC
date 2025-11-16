# webRTC
A sample video chat application. It uses the p2p webrtc protocol.

## Dependencies
Docker v28+

## Prerequisites
Fire up Docker and run the following commands:

```
$ git clone https://github.com/JayKay24/webRTC.git
$ cd webRTC
$ docker build -t <YOUR_USERNAME>:<ANY_IMAGE_NAME_YOU_WISH>:1.0.0
```

e.g YOUR_USERNAME=jay, ANY_IMAGE_NAME_YOU_WISH=webrtc

## Instructions
To run it locally, you will first need to know the IP address assigned to your device/host. e.g on Mac see:
![IP Address](/docs/ip_address.png)

Run the following:
```
$ docker run -it --name webrtc -p 3000:3000 <YOUR_USERNAME>:<ANY_IMAGE_NAME_YOU_WISH>:1.0.0
```

Type the following to your browser search bar:
```
https://<YOUR_IP_ADDRESS>:3000
```

Use this same URL on your other device e.g phone to connect to the video chat peer.

You should see an interface similar to:
![webRTC app](/docs/p2p_video_chat.png)

NB: The above image shows running it side by side on the same host and browser. Don't turn on the mic if you choose to run it like this. There will be a lot of mic feedback.
