function WordleStats(dbManager, wordleBot) {
    this.db = dbManager;
	this.WordleBot = wordleBot;
}

WordleStats.prototype.handleRequest = async function (message) {
	const db = this.db;
    const userServerGameRecords = await db.qryUserServerGameRecords(message.author.id, message.guildId);
		if(userServerGameRecords.length == 0) {
			console.log(message.author.username + " requested stats but was not yet a member on server "+message.guildId+" "+message.guild.name);
			message.author.send("Send \"!join\" in the #"+message.channel.name+" channel to play and record some stats!");
			return;
		}
		const userServerGamesStarted = await db.qryUserServerGamesStarted(message.author.id, message.guildId);
		const numGamesStarted = userServerGamesStarted.length;
		const userServerGamesWon = await db.qryUserServerGamesWon(message.author.id, message.guildId);
		const winPercentage = ((userServerGamesWon.length / (numGamesStarted == 0 ? 1 : numGamesStarted)).toFixed(2))*100+"%";

		const userServerCurrentWinStreak = await db.qryUserServerCurrentWinStreak(message.author.id, message.guildId);
		let currentWinStreak = 0;
		if(userServerCurrentWinStreak.length > 0){
			currentWinStreak = userServerCurrentWinStreak[0].streak;
		}
		const userServerMaxWinStreak = await db.qryUserServerMaxWinStreak(message.author.id, message.guildId);
		let maxStreak = 0;
		if(userServerMaxWinStreak.length > 0){
			maxStreak = userServerMaxWinStreak[0].streak;
		}
		const userServerHardGamesCompleted = await db.qryUserServerHardGamesCompleted(message.author.id, message.guildId);
		const hardGamePercentage = ((userServerHardGamesCompleted.length / (numGamesStarted == 0 ? 1 : numGamesStarted)).toFixed(2))*100+"%";
		let guessDistribution = [0,0,0,0,0,0];
		let distributionTotal = 0;
		for(var i = 0; i < userServerGamesWon.length; i++){
			guessDistribution[userServerGamesWon[i].num_guesses-1]++;
			distributionTotal++;
		}
		let userServerStatisticsMessage = "<@"+message.author.id+">\'s ServerWordle Stats\n";
		userServerStatisticsMessage += "Games: "+numGamesStarted+ " | Win %: "+winPercentage+" | Streak: "+currentWinStreak+" | Max: "+maxStreak+" | Hard %: "+hardGamePercentage+"\n";
		userServerStatisticsMessage += "Guess distribution for won games:\n```"
		for(var i = 0; i < 6; i++){
			userServerStatisticsMessage+=(i+1)+": "
			if(distributionTotal > 0) {userServerStatisticsMessage += "|".repeat((guessDistribution[i]/distributionTotal)*50);}
			if(guessDistribution[i]>0){
				userServerStatisticsMessage += " ("+guessDistribution[i]+")";
			}
			userServerStatisticsMessage+="\n";
		}
		userServerStatisticsMessage+="```";
		message.channel.send(userServerStatisticsMessage);
}

module.exports = {
    WordleStats
}