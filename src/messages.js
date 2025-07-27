const { Message } = require('discord.js');
const moment = require('moment');

function Messages(message = undefined, user = undefined) {
    this.message = message;
    if(!user) {
        this.user = this.message.author;
    }
    else {
        this.user = user;
    }
}

Messages.prototype.userAlreadyJoinedServer = function() {
    this.message.author.send("Hey <@"+this.message.author.id+"> - you have already joined on this server! ("+this.message.guild.name+")\nSend me a guess to play!");
}

Messages.prototype.welcomeUser = function(channelName) {
    this.message.author.send("Hey <@"+this.message.author.id+">, welcome to ServerWordle! Send me your guesses for the 5-letter word I'm thinking of today, competing against everyone on "+this.message.guild.name+"."
                        +"\nAfter each guess I'll give you some clues to help:"
                        +"\n    🟩 : This letter is in the correct position."
                        +"\n    🟦 : This letter appears in my word but not in this position."
                        +"\n    ⬜ : This letter doesn't appear in my word. Try another!"
                        +"\nAdvanced: your attempt will be marked as hard (*) if you always use any green and blue hints in subsequent guesses."
                        +"\nView stats by sending **!stats** in the #"+channelName+" channel of your server. Contact <@959962942718242868> with any questions."
                        +"\n\nLet's play!");
}

Messages.prototype.firstGuessIntro = function(wordleNumber, serverName) {
    this.user.send(`\nServerWordle #${wordleNumber} for server ${serverName}. Send me your first guess...\n`);
}

Messages.prototype.upToDateOnServer = function(serverName) {
    const timeUntilMidnight = moment(moment().format('YYYY-MM-DD') + ' 00:00:00').add(1, "days").unix();
    this.user.send(`You are up to date on this server! (${serverName}) Try again <t:${timeUntilMidnight}:R>.`);
}

Messages.prototype.unregisteredUser = function() {
    this.user.send("Hey <@"+this.user.id+"> - great to meet you!\nPlease send **!join** in the #wordle-bot channel of your server and I'll set up a game for you 🤓.\nNote: your server admin may have changed which channel I live in, so ask them for help if you can't locate the channel!");
}

Messages.prototype.completedAllWordles = function() {
    const timeUntilMidnight = moment(moment().format('YYYY-MM-DD') + ' 00:00:00').add(1, "days").unix();
    this.message.author.send(`You're all caught up! Message me again <t:${timeUntilMidnight}:R> to try your next ServerWordle!`);				
}

Messages.prototype.nextWordleTime = function() {
    const timeUntilMidnight = moment(moment().format('YYYY-MM-DD') + ' 00:00:00').add(1, "days").unix();
    this.message.author.send(`Message me again <t:${timeUntilMidnight}:R> to try your next ServerWordle!`);				
}

Messages.prototype.gameLogError = function() {
    this.message.author.send("Error #7: game log mismatch. Please contact admin.");
}

Messages.prototype.invalidFiveLetterWord = function() {
    return this.message.author.send("Sorry that wasn't a valid word. Please enter a different 5-letter word guess.");
}

Messages.prototype.duplicateGuess = function(word) {
    return this.message.author.send(`You've already guessed that word (${word}). Try another one!`);
}

Messages.prototype.validGuessResponse = function(wordleNumber, serverName, userState, previousGuessButtonRows, currentGuessButtonRow) {
    this.message.author.send(`ServerWordle #${wordleNumber} (for server ${serverName})`);
	if(userState!==1){
		this.message.author.send({content: "Previous guesses:", components: previousGuessButtonRows});
	}
    this.message.author.send({content: "Your guess ("+userState+"/6):", components: [currentGuessButtonRow]});
}

Messages.prototype.wonGame = function(wordleNumber, userState) {
    this.message.author.send(`Well done! You correctly guessed ServerWordle #${wordleNumber} in ${userState} guesses.`);
}

Messages.prototype.lostGame = function(wordleNumber, wordleAnswer) {
    this.message.author.send("Unlucky! You didn't get ServerWordle #"+wordleNumber+". The correct answer was ||"+wordleAnswer+"||.");
}

Messages.prototype.promptCheckNewGames = function() {
    this.message.author.send("Wait! ✋ You have more ServerWordles to complete! Choose the server with a reaction, or send me a message and I'll find the next game for you. 🕵️‍♂️");
}

Messages.prototype.serverListWithReacts = async function(serverNames) {
    if(serverNames.length === 0) {
        return;
    }
    const serverSelectEmojis = ["🍎", "🍌", "🥕", "🍩", "🍆"];
    let messageText = "**React to play ServerWordle!**";
    serverNames = serverNames.slice(0,5);
    for(const [i, name] of serverNames.entries()) {
        messageText += `\n${serverSelectEmojis[i]} ${name}`;
    }
    let sentMessage = await this.user.send(messageText);
    for(const [i, name] of serverNames.entries()) {
        sentMessage.react(serverSelectEmojis[i]);
    }
}

Messages.prototype.remainingLetters = function(letters) {
    this.message.author.send("Remaining letters:\n"+letters);
}

Messages.prototype.joinedButGameInProgress = function(serverName) {
    this.message.author.send("Joined on server "+serverName+". Don't let this distract you from your current game! Send your next guess...");
}

Message.prototype.joinNotificationShort = function(serverName) {
    this.message.author.send("");
}

Messages.prototype.botNotAllowed = function() {
    this.user.send("I can't start a game on that server (I might have been kicked!)");
}

Messages.prototype.terminatingGame = function() {
    this.user.send("I can't access that server any more. Your current game will be terminated.");
}


module.exports = {
    Messages,
}