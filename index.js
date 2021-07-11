const Discord = require('discord.js');
const icy = require('icy');
const fs = require('fs');
var express = require('express');
var app = express();
const client = new Discord.Client();
const {
	prefix,
	token,
	voicechannel,
	logchannel,
	activity,
	list
} = require('./config.json');

var serverQueue = [...list];

client.once('ready', () => {
	clientLogMessage("Státusz: Csatlakozva");
	playStream();
});

client.once('reconnecting', () => {
	clientLogMessage("Státusz: újracsatlakozva");
	playStream();
});

client.once('disconnect', () => {
	clientLogMessage("Státusz: Lecsatlakozva");
});

client.on('message', async message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;
	const args = message.content.slice(prefix.length).split(' ');
	const command = args.shift().toLowerCase();
});

client.login(token);

function playStream() {
	client.channels.fetch(voicechannel).then(chanel => {
		chanel.join().then(connection => {
			clientLogMessage("Státusz: Successfully connected to voice channel");
			if (activity) changeActivity(activity);
			
			connection.on("debug", e => {
				if (e.includes('[WS] >>') || e.includes('[WS] <<')) return;
				clientLogMessage("Státusz: Connection warning - " + e);
				//if(e.includes('[WS] closed')) abortWithError();
			});
			connection.on("disconnect", () => {
				clientLogMessage("Státusz: Connection disconnect");
			});
			connection.on("error", e => {
				clientLogMessage("Státusz: Connection error");
				console.log(e);
			});
			connection.on("failed", e => {
				clientLogMessage("Státusz: Connection failed");
				console.log(e);
			});
			
			initDispatcher(connection);
		}).catch(e => {
			clientLogMessage("Státusz: Chanel connection error");
			console.log(e);
		});
	}).catch(e => {
		clientLogMessage("Státusz: Chanel not found");
		console.log(e);
	});
}

function initDispatcher(connection) {
	clientLogMessage("Státusz: Broadcast started");
	
	if (serverQueue === undefined || serverQueue.length == 0) {
		clientLogMessage("Státusz: Repeating entire playlist");
		serverQueue = [...list];
	}
	const currentTrack = serverQueue.shift();
	if (currentTrack.name) changeActivity(currentTrack.name);
	
	const streamDispatcher = connection.play(currentTrack.url, {
			volume: false,
			highWaterMark: 512,
			bitrate: 128,
			fec: true
		})
		.on("finish", () => {
			clientLogMessage("Státusz: Broadcast was finished");
			streamDispatcher.destroy();
			initDispatcher(connection);
		});
		
	streamDispatcher.setBitrate(128);
	streamDispatcher.setFEC(true);
	
	streamDispatcher.on("debug", e => {
		clientLogMessage("Státusz: Dispatcher warning - " + e);
	});
	streamDispatcher.on("error", e => {
		clientLogMessage("Státusz: Broadcast connection error");
		console.log(e);
		abortWithError();
	});
	
	getICY(currentTrack.url);
}

function getICY(url) {
	const icyReader = icy.get(url, function (i) {
		i.on('metadata', function (metadata) {
			let icyData = icy.parse(metadata);
			if (icyData.StreamTitle) changeActivity(icyData.StreamTitle);
		});
		i.resume();
	});
}

function abortWithError() {
	clientLogMessage("Státusz: The connection to the radio station is interrupted or it does not respond, interrupting the process");
	streamDispatcher.destroy();
	process.exit(1);
}

function clientLogMessage(message) {
	client.channels.fetch(logchannel).then(chanel => {
		chanel.send(message)
	}).catch(e => console.log(e));
	
	console.log(message);
}

function changeActivity(message) {
	clientLogMessage("Now playing: " + message);
	client.user.setActivity(message, {
		type: 'LISTENING'
	});;
}