const {
	Client,
	Intents,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	Permissions
} = require('discord.js');
const util = require('util');
const config = require('./config.json');
const words = require('./words.json');
const moment = require('moment');
const fetch = require('node-fetch');
const GuessList = words.guesslist.concat(words.answerlist);
const AnswerList = words.answerlist;
const UserStates = {
	PreGame:0,
	Guess1:1,
	Guess2:2,
	Guess3:3,
	Guess4:4,
	Guess5:5,
	Guess6:6
}
let customChannelCache = new Map();
const db = require('./database.js');
const WordleBot = new Client({
	intents:[Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, 
			Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.DIRECT_MESSAGE_REACTIONS, 
			Intents.FLAGS.DIRECT_MESSAGE_TYPING],
	partials:['CHANNEL']
});

db.connect(async  err => {
    if (err) return console.log(err);
    console.log(`MySQL has been connected!`);
    console.log("Local time: "+moment().format('YYYY-MM-DD HH:mm:ss'));
	buildCustomChannelCache();
	console.log("executing bot login");
	WordleBot.login(config.token);
	console.log("done executing bot login");
	refreshAnswers();
	setInterval(refreshAnswers, 1000 * 60 * 1);
	dailyReminder();
	setInterval(dailyReminder, 1000 * 60 * 1);
	// weeklyLeaderboard();
	// setInterval(weeklyLeaderboard, 1000 * 60 * 1);
	//aliveStatus();
	//setInterval(aliveStatus, 1000 * 60 * 60);
	metricsUpdate();
	setInterval(metricsUpdate, 1000 * 60 * 10);
});

async function test() {
	console.log((await db.qryServersWithAnswers()));
}

const {WordleStats} = require("./wordlestats.js");
const Stats = new WordleStats(db, WordleBot);

// const {WeeklyLeaderboard} = require("./leaderboard.js");
// const Leaderboard = new WeeklyLeaderboard(db, WordleBot);

const {Messages} = require("./messages.js");

WordleBot.on('ready', () => {
	console.log(`Bot ${WordleBot.user.tag} is logged in!`);
});

WordleBot.on("guildCreate", async guild => {
	try {
		let channel = WordleBot.channels.cache.find(e => (e.guildId === guild.id) && (e.name === "wordle-bot"));
		if(channel === undefined) {
			await guild.channels.create("wordle-bot", "text");
			channel = WordleBot.channels.cache.find(e => (e.guildId === guild.id) && (e.name === "wordle-bot"));
		}
		await updateCustomChannel(guild.id,channel.id);
		channel.send(`Hi, I'm ServerWordle. First type **!join**, then DM me each day to play wordle against everyone on your server. View your stats with **!stats**. Admins can change my channel with **!summonserverwordle.**`).then(msg => msg.pin());
		const owner = await guild.fetchOwner();
		owner.send(`Thanks for inviting ServerWordle! I've set up a wordle-bot text channel in your server. Head over there and type **!join** to get started! If you want to use another channel for the bot, type **!summonserverwordle** in the desired channel.`);
		console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
	}
	catch(e){
		const owner = await guild.fetchOwner();
		owner.send(`ServerWordle needs all the requested permissions to function. Please kick and then re-invite the bot, allowing all requested permissions!`);
		console.log("Error: Bot added to server "+guild.id+" "+guild.name+" without full permissions!");
	}
 });

WordleBot.on('messageCreate', async (message) => {
	
	//!summonserverwordle
	if(message.channel.type != 'DM' && !message.author.bot && message.content == "!summonserverwordle"){
		if(message.member.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS)) {
			await updateCustomChannel(message.guildId, message.channelId);
			const channel = message.channel;
			try{
			channel.send(`Hi, I'm ServerWordle. First type **!join**, then DM me each day to play wordle against everyone on your server. View your stats with **!stats**. Admins can change my channel with **!summonserverwordle**.`).then(msg => msg.pin());		
		}
			catch(e){
				console.log("Error sending welcome message and pin after !summonserverwordle for channel "+message.channel.name+" "+message.channelId+" on server "+message.guild.name+ " "+message.guildId);
			}
		}
		else{
			message.author.send("You need to have the MANAGE_CHANNELS permission to use the !summonserverwordle command!");
		}
	}

	let targetChannelId = "-1";
	if(message.channel.type != 'DM' && !message.author.bot){
		targetChannelId = customChannelCache.get(message.guildId);
	}
	// !stats
	if(message.channel.id == targetChannelId && message.content == "!stats" && message.author.bot == false) {
		await Stats.handleRequest(message);
	}
	// !join
	if(message.channel.id == targetChannelId && message.content == "!join" && message.author.bot == false) {
		const msg = new Messages(message);
		const userServerGameRecords = await db.qryUserServerGameRecords(message.author.id, message.guildId);
		if(userServerGameRecords.length > 0) {
			msg.userAlreadyJoinedServer(message);
			return;
		}
		else {//new user for this server
			let serversWithAnswers = await db.qryServersWithAnswers();
			if(serversWithAnswers.filter(e => e.server === message.guildId).length == 0) { //new user and new server
				console.log("Create first wordle for server id "+message.guildId +" "+message.guild.name);
				const chosenAnswer = AnswerList[Math.floor(Math.random()*AnswerList.length)].toUpperCase();
				await db.insertAnswerRow(message.guildId, chosenAnswer, 1);
			}
			const serverLatestAnswer = await db.qryServerLatestAnswer(message.guildId);
			const wordleNumber = serverLatestAnswer[0].wordle_number;
			const userGameLogsNotJoin = await db.qryUserGameLogsNotJoin(message.author.id);
			if(userGameLogsNotJoin.length == 0){
				await db.insertGameLogJoin(message.author.id, message.guild.id, wordleNumber);
				await db.insertGameLogStart(message.author.id, message.guild.id, wordleNumber);
				const customChannel = customChannelCache.get(message.guildId);
				msg.welcomeUser(message.channel.name);
				msg.firstGuessIntro(wordleNumber,message.guild.name);
			}
			else{
				const latestGameLogNotJoin = userGameLogsNotJoin[userGameLogsNotJoin.length-1];
				
				if(latestGameLogNotJoin.event_type == "START") { //user is in game
					await db.insertGameLogJoin(message.author.id, message.guild.id, wordleNumber);
					msg.joinedButGameInProgress(message.guild.name);
				}
				else{//skip full welcome for any further servers joined
					await db.insertGameLogJoin(message.author.id, message.guild.id, wordleNumber);
					await db.insertGameLogStart(message.author.id, message.guild.id, wordleNumber);
					msg.firstGuessIntro(wordleNumber,message.guild.name);
				}
			}		
			return;
		}
	}
	//on received DM
	if(message.channel.type == 'DM' && !message.author.bot) {
		const msg = new Messages(message);
		const userGameLogs = await db.qryUserGameLogs(message.author.id);
		if(userGameLogs.length == 0) {
			console.log("Unregistered user "+message.author.username+" DMd bot");
			msg.unregisteredUser();
			return;
		}
		else {
			await handleGame(message);	
			return;	
		}
	}
});

async function handleGame(message) {
	const userGameLogsNotJoin = await db.qryUserGameLogsNotJoin(message.author.id);
	const latestGameLogNotJoin = userGameLogsNotJoin[userGameLogsNotJoin.length-1];
	if(latestGameLogNotJoin.event_type == "START") { //user is in game
		await processGameResponse(message, latestGameLogNotJoin.wordle_number, latestGameLogNotJoin.server);
	}
	else {
		const newGameSucceeded = await tryCreateNewGame(message);
		if(!newGameSucceeded){
			const msg = new Messages(message);
			msg.completedAllWordles();
		}
	}
}

async function tryCreateNewGame(message, execute=true) {
	const userServersJoined = await db.qryUserServersJoined(message.author.id);
	for(let serverRow of userServersJoined) {
		const newGameFound = await queryNewGameForUserServer(message.author.id,serverRow.server);
		if(newGameFound){ 
			if(execute==true) {
				const answerRow = await db.qryServerLatestAnswer(serverRow.server);
				const wordleNumber = answerRow[answerRow.length-1].wordle_number;
				db.insertGameLogStart(message.author.id, serverRow.server, wordleNumber)
				const serverName = await WordleBot.guilds.fetch(serverRow.server);
				const msg = new Messages(message);
				msg.firstGuessIntro(wordleNumber, serverName);
			}
			return true;
		}
	}
	return false;
}

async function queryNewGameForUserServer(userId, serverId) {
	const userServerGameRecords = await db.qryUserServerGameRecords(userId, serverId);
	const lastWordlePlayed = await db.qryUserServerGamesStarted(userId, serverId);
	const serverLatestAnswer = await db.qryServerLatestAnswer(serverId);
	if(lastWordlePlayed.length == 0 || serverLatestAnswer[0].wordle_number > lastWordlePlayed[lastWordlePlayed.length-1].wordle_number){
		return true;
	}
	return false;
}

async function processGameResponse(message, wordleNumber, serverId){
	const msg = new Messages(message);
	const serverAnswer = await db.qryServerAnswerByWordleNumber(serverId, wordleNumber);
	if(serverAnswer.length == 0) {
		console.log("Error #7: game log mismatch for user "+message.author.username+" on server "+serverId+"with wordle number"+wordleNumber);
		msg.gameLogError();
		return;
	}
	var wordleAnswer = serverAnswer[0].answer;
	const userSelectedGuessLog = await db.qryUserServerGuessLogSpecific(message.author.id, serverId, wordleNumber);
	const userState = userSelectedGuessLog.length+1;
	switch(userState) {
		case UserStates.Guess1:
		case UserStates.Guess2:
		case UserStates.Guess3:
		case UserStates.Guess4:
		case UserStates.Guess5:
		case UserStates.Guess6:				 
			if(GuessList.includes(message.content.toLowerCase())) {	
				sendFrontendResponse(message, serverId, wordleNumber, userState, msg);
			}
			else{
				msg.invalidFiveLetterWord()
				.then(msg => {setTimeout(() => msg.delete(), 5000)})
				.catch(console.error);	
			}
			break;
	}
}

async function sendFrontendResponse(message, serverId, wordleNumber, userState, msg) {
	const serverAnswer = await db.qryServerAnswerByWordleNumber(serverId, wordleNumber);
	const wordleAnswer = serverAnswer[0].answer;
	let serverName = await WordleBot.guilds.fetch(serverId);			
	let userGuesses = [];
	let guessColours = [];
	const userGuessLog = await db.qryUserServerGuessLogSpecific(message.author.id, serverId, wordleNumber);
	for(let i = 0; i < userGuessLog.length; i++) {
		userGuesses.push(userGuessLog[i].guess);
		guessColours.push(userGuessLog[i].colours);
	}
	var previousGuessButtonRows = [];
	for(let i = 0; i < userGuesses.length; i++) {
		previousGuessButtonRows.push(generateButtons(userGuesses[i],guessColours[i],i));
	}
	db.insertGuessLog(message.author.id, serverId, wordleNumber, message.content.toUpperCase(), getColours(message.content.toUpperCase(),wordleAnswer));
	userGuesses.push(message.content.toUpperCase());
	guessColours.push(getColours(message.content.toUpperCase(),wordleAnswer));
	let currentGuessButtonRow = generateButtons(userGuesses[userGuesses.length-1],guessColours[guessColours.length-1],6);
	msg.validGuessResponse(wordleNumber, serverName, userState, previousGuessButtonRows, currentGuessButtonRow);
	if(message.content.toUpperCase() == wordleAnswer) {
		msg.wonGame(wordleNumber, userState);
		const difficulty = getDifficulty(userGuesses,guessColours,wordleAnswer);
		const streak = await calcStreakOnWin(message.author.id, serverId, wordleNumber);
		await db.insertGameLogWin(message.author.id,serverId,wordleNumber,userState,difficulty,streak);
		await publishAnswer("WIN",wordleNumber,userState,guessColours,difficulty,message.author.id,serverId);
		const hasNewGame = tryCreateNewGame(message, false);
		if(hasNewGame) {
			msg.promptCheckNewGames();
		}
		else {
			msg.nextWordleTime();
		}
	}
	else if(userState == UserStates.Guess6) {
		msg.lostGame(wordleNumber, wordleAnswer);
		const difficulty = getDifficulty(userGuesses,guessColours,wordleAnswer);
		await db.insertGameLogLose(message.author.id, serverId, wordleNumber, difficulty);
		await publishAnswer("LOSE",wordleNumber,userState,guessColours,difficulty,message.author.id,serverId);
		const hasNewGame = tryCreateNewGame(message, false);
		if(hasNewGame) {
			msg.promptCheckNewGames();
		}
		else {
			msg.nextWordleTime();
		}	

	}
	else{
		let lettersRemaining = getRemainingLetters(userGuesses,wordleAnswer);
		msg.remainingLetters(lettersRemaining);
	}
}

async function publishAnswer(winOrLoseStatus,wordleNumber,userState,guessColours,difficulty,userId,serverId) {
	let guessString = userState;
	if( winOrLoseStatus == "LOSE") {guessString = "X";}
	let messageString = "ServerWordle #"+wordleNumber+" "+guessString+"/6";
	if(difficulty == "HARD") {messageString += "*";}
	messageString += "\n<@" + userId + ">";
	let streak = await db.qryUserServerCurrentWinStreak(userId, serverId);
	if(streak[0].streak >= 3) {
		const emoji = await getStreakEmoji(streak[0].streak);
		messageString += " - "+streak[0].streak+" win streak! " + emoji;
	}
	let colourMap = new Map([["B", "⬜"],["Y", "🟦"],["G", "🟩"]]);
	for(let i = 0; i < guessColours.length; i++) {
		messageString += "\n"
		for(let j = 0; j < 5; j++) {
			messageString += colourMap.get(guessColours[i].split("")[j]);
		}
	}
	messageString += "\n";
	//look for appropriate channel to publish result
	try {
		const targetChannelId = customChannelCache.get(serverId);
		const channel = await WordleBot.channels.fetch(targetChannelId);
		channel.send(messageString);
		let serverName = await WordleBot.guilds.fetch(serverId);
		WordleBot.users.fetch(userId).then((user) => user.send(`Your result has been published to the ${channel.name} channel on server ${serverName}!`));
	}
	catch(err){
		//no channel found
		WordleBot.users.fetch(userId).then((user) => user.send("\"wordle-bot\" channel not found on server. Could not publish result. Please contact your server admin and ask them to use the **!summonserverwordle** command in a new channel."))
	} 
}

async function getStreakEmoji(num) {
	if(num < 3){
		return "";
	}
	//const streakEmojis = "🎈👏🔥💪🥳🎓🙌👀🎺👑💃😏🔮💎🙀🧁🍾🏆😳📯🚀🌞📈🎂🥂🤠🧠✨";
	const streakEmojis = [
		"\:balloon:",
		"\:clap:",
		"\:fire:",
		"\:muscle:",
		"\:partying_face:",
		"\:mortar_board:",
		"\:raised_hands:",
		"\:eyes:",
		"\:trumpet:",
		"\:crown:",
		"\:dancer:",
		"\:smirk:",
		"\:crystal_ball:",
		"\:gem:",
		"\:scream_cat:",
		"\:cupcake:",
		"\:champagne:",
		"\:trophy:",
		"\:flushed:",
		"\:postal_horn:",
		"\:rocket:",
		"\:sun_with_face:",
		"\:chart_with_upwards_trend:",
		"\:birthday:",
		"\:champagne_glass:",
		"\:cowboy:",
		"\:brain:",
		"\:sparkles:"
	];
	if(num > streakEmojis.length+2) {
		//console.log("adding prestige");
		return "\:moyai:"+ await getStreakEmoji(num-streakEmojis.length);
	}
	else {
		//console.log(streakEmojis[num-3],"added");
		return streakEmojis[num-3];
	}
}

async function aliveStatus(){
	console.log("ALIVE at "+moment().format('YYYY-MM-DD HH:mm:ss'));
}

async function refreshAnswers() {	//get list of latest wordle entries for each server
	let allServersLatestAnswers = await db.qryAllServersLatestAnswers();
	let now = moment();
	for(let i = 0; i < allServersLatestAnswers.length; i++) {		
		let then = moment(allServersLatestAnswers[i].date);		
		if(now.diff(then.endOf('day'))>0) {		
			let pastAnswers = await db.qryServerLastNAnswers(allServersLatestAnswers[i].server, 365);
		    let pastArr = [];
		    for(let j = 0; j < pastAnswers.length; j++){
		    	pastArr.push(pastAnswers[j].answer.toLowerCase());
		    }
			const newWordle = AnswerList.filter(e => !pastArr.includes(e))[Math.floor(Math.random()*(AnswerList.length-pastArr.length))].toUpperCase();
			await db.insertAnswerRow(allServersLatestAnswers[i].server,newWordle,(allServersLatestAnswers[i].wordle_number+1));
		}
	}
}

async function doesUserHaveNewGame(userId) {
	const userServersJoined = await db.qryUserServersJoined(userId);
	for(let serverRow of userServersJoined) {
		const newGameFound = await queryNewGameForUserServer(userId,serverRow.server);
		if(newGameFound){ 
			return true;
		}
	}
	return false;
}

async function hasUserPlayedRecently(userId) {
	const userGameLogsNotJoin = await db.qryUserGameLogsNotJoin(userId);
	if(userGameLogsNotJoin.length == 0) {
		return false;
	}
	const lastTime = moment(userGameLogsNotJoin[userGameLogsNotJoin.length-1].date);
	return !(moment().diff(lastTime, 'days') > 7);
}

async function dailyReminder() {
	const nextScheduledTime = await db.getScheduledMessageLastTime("daily reminder");
	if(moment().diff(nextScheduledTime) > 0) {
		const reminderStrings = [
			"🌅 Good morning! It's time for ServerWordle! 🔠",
			"😎 Wake the 💥 up samurai... 🙂🕶👌 we have a ServerWordle to do.",
			"Don't forget to do your ServerWordle! 🔫🦉",
			"Would it be ok if we played ServerWordle together? 👉👈 Nah you're right, it would be weird... unless? 😳",
			"It's wordlin' time! ⌚",
			"I'm thinking of a 5-letter word... 🧠",
			"I'm thinking of a 5-letter word... it's not crane. 🏗 Or is it? 🤔",
			"Have you done your ServerWordle? 📚",
			"Have you done today's ServerWordle? 📅",
			"Hey - it's ServerWordle time! ⏰",
			"⚠🚨 New ServerWordle dropped! 🚨⚠",
			"Let's play ServerWordle! 🚀",
			"There is 1 wordle among us ඞ",
			"Think of a word, any word... ✨"
		];
		const greeting = reminderStrings[Math.floor(Math.random()*reminderStrings.length)];
		const users = await db.qryAllUniqueUsers();
		for(let userRow of users) {
			const newGameAvailable = await doesUserHaveNewGame(userRow.user);
			const isRecentPlayer = await hasUserPlayedRecently(userRow.user);
			if(newGameAvailable && isRecentPlayer) {
				WordleBot.users.fetch(userRow.user).then((user) => user.send(greeting));
			}
		}
		const updatedTime = nextScheduledTime.add(1, 'days').format('YYYY-MM-DD HH:mm:ss');
		await db.updateScheduledMessageLastTime("daily reminder", updatedTime);
	}
}

async function weeklyLeaderboard() {
	// TODO
	// const servers = await db.qryServersWithAnswers();
	// for(let serverRow of servers) {
	
	// }
}

function getDifficulty(guesses,colours,wordle) {	
	if(guesses.length==1){return "HARD";} 
	else {
		for(let i = 1; i < guesses.length; i++){
			requiredLetters = [];
			requiredPositions = [];
			for(let j = 0; j < 5; j++){
				if(colours[i-1].split("")[j] !== "B") {
					requiredLetters.push(guesses[i-1].split("")[j]);
				}
				if(colours[i-1].split("")[j] == "G") {
					requiredPositions.push(j);
				}
			}
			let letters = guesses[i].split("");
			for(let k = 0; k < 5; k++) {
				if(requiredLetters.indexOf(letters[k])>-1) {
					requiredLetters.splice(requiredLetters.indexOf(letters[k]),1);
				}
			}
			if(requiredLetters.length > 0) {return "EASY";}
			for(let l = 0; l < requiredPositions.length; l++){
				if(letters[requiredPositions[l]] !== guesses[i-1].split("")[requiredPositions[l]]){
					return "EASY";
				}
			}
		}
		return "HARD";
	}
}

async function calcStreakOnWin(userId,serverId,wordleNumber) {
	const userGameLogWins = await db.qryUserServerGamesWon(userId, serverId);
	if(userGameLogWins.length > 0) {
		let wnum = userGameLogWins[userGameLogWins.length-1].wordle_number;
		if((wordleNumber - wnum) == 1) {
			return userGameLogWins[userGameLogWins.length-1].streak+1;
		}
	}
	return 1;
}

//todo daily reminder

function generateButtons(word, colours, offset=0) {
	let row = new MessageActionRow()
	for(let i = 0; i < 5; i++) {
		row.addComponents(
			new MessageButton()
			.setCustomId('test'+i+offset*5)
			.setLabel(word[i])
			.setStyle(colours[i] == 'B' ? 'SECONDARY' : (colours[i] == 'Y' ? 'PRIMARY' : 'SUCCESS'))
			);
	}		
	return row;
}

function getColours(guess, wordle) {
	let guessLetters = guess.split("");
	let answerLetters = wordle.split("");
	let colours = "BBBBB".split("");
	//array to remove letters from so that we don't colour too many
	let uncolouredLetters = wordle.split("");
	for(let i = 0; i < answerLetters.length; i++){
		if(answerLetters[i] == guessLetters[i] && uncolouredLetters.includes(guessLetters[i])) {
			colours[i] = "G";
			const index = uncolouredLetters.indexOf(guessLetters[i]);
			if(index > -1) {
				uncolouredLetters.splice(index,1);
			}
		}
	}
	//second pass for Y
	for(let i = 0; i < answerLetters.length; i++){
		if(answerLetters.includes(guessLetters[i]) && colours[i] !== "G"){
				const index = uncolouredLetters.indexOf(guessLetters[i]);
				if(index > -1) {
					//only colour if we have possible letters left in the word
					colours[i] = "Y";
					uncolouredLetters.splice(index,1);
				}
			}
	}
	return colours.join("");
}

function getRemainingLetters(guesses,wordle) {
	let lettersRemaining = "```"+
						   "q w e r t y u i o p\n"+
						   " a s d f g h j k l\n"+
						   "  z x c v b n m"+
						   "```";
	let colours = [];
	for(let i = 0; i < guesses.length; i++){
  		colours.push(getColours(guesses[i],wordle));
  	}
  	for(let i = 0; i < colours.length; i++) {  	//change green or yellow
  		for(let j = 0; j<5; j++) {
  			if(colours[i].charAt(j)!=="B") {
				lettersRemaining = lettersRemaining.replace(guesses[i].charAt(j).toLowerCase(),guesses[i].charAt(j));
			}
		}
	}
	for(let i = 0; i < colours.length; i++) {	//change black
  		for(let j = 0; j<5; j++) {
  			if(colours[i].charAt(j)=="B") {
				lettersRemaining = lettersRemaining.replace(guesses[i].charAt(j).toLowerCase(),"-");
			}
		}
	}
	return lettersRemaining;
}

WordleBot.on('interactionCreate', interaction => {
	if (!interaction.isButton()) return;
});

async function metricsUpdate() {
	const servers = await db.qryServersWithAnswers();
	const gamesPlayed = await db.qryCompletedGames();
	let users = 0;
	for(const serverRow of servers) {
		const uniqueUsers = await db.qryServerUniqueUsers(serverRow.server);
		users += uniqueUsers.length;
	}

	let data = {
		users: users,
		servers: servers.length,
		wordlesAnswered: gamesPlayed.length,
		secret: config.secret
	};

	fetch(config.APIEndpoint, {
		method:"POST",
		body: JSON.stringify(data),
		headers: {"Content-Type": "application/json"}
	}).catch(err => console.log(err));

	//console.log(`Running on ${servers.length} servers with ${users} users. ${gamesPlayed.length} games completed.`);
}

async function buildCustomChannelCache() {
	const customChannels = await db.qryCustomChannels();
	for(const customChannelTableRow of customChannels) {
		customChannelCache.set(customChannelTableRow.server, customChannelTableRow.custom_channel);
	}
	console.log("Built custom channel cache.");
}

async function updateCustomChannel(serverId, newChannelId){
	db.updateCustomChannel(serverId, newChannelId);
	customChannelCache.set(serverId, newChannelId);
	try{
	const channel = await WordleBot.channels.fetch(newChannelId);
	console.log("Update custom channel to channel "+channel.name+" "+newChannelId+" on server "+channel.guild.name+" "+serverId);
	}
	catch(e) {
		console.log("Error updating custom channel to channel "+newChannelId+" on server "+serverId+"\n"+e);
	}
}