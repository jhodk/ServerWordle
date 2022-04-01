const {
	Client,
	Intents,
	MessageActionRow,
	MessageButton,
	MessageEmbed
} = require('discord.js');

const util = require('util');

const config = require('./config.json');
const words = require('./words.json');
const moment = require('moment');

const GuessList = words.guesslist.concat(words.answerlist);
const AnswerList = words.answerlist;

//var wordle = AnswerList[Math.floor(Math.random()*AnswerList.length)].toUpperCase();

//var userGuesses = [];

const UserStates = {
	PreGame:0,
	Guess1:1,
	Guess2:2,
	Guess3:3,
	Guess4:4,
	Guess5:5,
	Guess6:6
}
//var userState = UserStates.PreGame;


const {createConnection} = require('mysql');

let con = createConnection(config.mysql);

con.connect(err => {
    // Console log if there is an error
    if (err) return console.log(err);

    // No error found?
    console.log(`MySQL has been connected!`);

    console.log("Local time: "+moment().format('YYYY-MM-DD HH:mm:ss'));
   
    refreshAnswers();
    setInterval(refreshAnswers, 1000 * 60 * 2);
    //check every so often, are we past the end of the day of the latest answer?

    //log if alive for general logging purposes
    aliveStatus();
    setInterval(aliveStatus, 1000 * 60 * 10);
   
});



const query = util.promisify(con.query).bind(con);




const bot = new Client({
	intents:[Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, 
			Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.DIRECT_MESSAGE_REACTIONS, 
			Intents.FLAGS.DIRECT_MESSAGE_TYPING],
	partials:['CHANNEL']
});

bot.on('ready', () => {
	console.log(`Bot ${bot.user.tag} is logged in!`);

	//let channels = bot.channels.cache.filter(e => (e.guildId == 855063245307904021) && (e.name == "wordle-bot"));
	//console.log();

});

bot.on('messageCreate', async (message) => {
	
	/*if(message.channel.name == "wordle-bot" && message.content == "!new" && message.author.bot == false) {

		const result2 = await query(`SELECT a.* FROM answers a`+
								   ` WHERE a.id = (SELECT MAX(a2.id) from answers a2 WHERE a2.server = `+
								   +message.guildId+`);`);

		var count = 0;
		if(result2.length>0){
			count = parseInt(result2[0].wordle_number);
		}

		const wordle = AnswerList[Math.floor(Math.random()*AnswerList.length)].toUpperCase();
				await query(`INSERT INTO answers values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+message.guildId+`','`
							+wordle+`','`
							+(count+1)+`');`);
	}*/

	if(message.channel.name == "wordle-bot" && message.content == "!stats" && message.author.bot == false) {

		const results0 = await query(`SELECT DISTINCT user FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+`;`);
		if(results0.length == 0) {
			console.log(message.author.username + " requested stats but was not yet a member on server "+message.guildId);
			message.author.send("Send \"!join\" in the #wordle-bot text channel to play and record some stats!");
			return;
		}

		console.log("Creating stats report for "+message.author.username+" on server "+message.guildId);
		//games started
		const results1 = await query(`SELECT * FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+` AND event_type = "START";`);
		const gamesStarted = results1.length;

		const results2 = await query(`SELECT * FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+` AND event_type = "WIN";`);
		const winPc = ((results2.length / (gamesStarted == 0 ? 1 : gamesStarted)).toFixed(2))*100+"%";

		const results3 = await query(`SELECT g.* FROM game_log g`+
								   ` WHERE g.id = (SELECT MAX(g2.id) from game_log g2 WHERE g2.server = `+
								   +message.guildId+` AND g2.user = `+message.author.id+` AND NOT event_type = "START");`);
		let currStreak = 0;
		if(results3.length > 0){
			currStreak = results3[0].streak;
		}


		
		const results4 = await query(`SELECT IFNULL(MAX(g1.streak),0) AS streak FROM (SELECT * FROM game_log WHERE user = `+message.author.id+
									` AND server = `+message.guildId+`) g1;`);

			//old result didn't work
			/*`SELECT g.* FROM game_log g`+
								   ` WHERE g.id = (SELECT MAX(g2.streak) from game_log g2 WHERE g2.server = `+
								   +message.guildId+` AND g2.user = `+message.author.id+` AND NOT event_type = "START");`);
		
		*/
		//IFNULL means that length should always be 1, but keep check just in case
		let maxStreak = 0;
		if(results4.length > 0){
			maxStreak = results4[0].streak;
		}


		const results5 = await query(`SELECT * FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+` AND difficulty = "HARD";`);
		const hardPc = ((results5.length / (gamesStarted == 0 ? 1 : gamesStarted)).toFixed(2))*100+"%";


		//guess distribution of wins

		const results6 = await query(`SELECT * FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+` AND event_type = "WIN";`);

		let dist = [0,0,0,0,0,0];
		let totalDist = 0;
		for(var i = 0; i < results6.length; i++){
			dist[results6[i].num_guesses-1]++;
			totalDist++;
		}



		/*console.log(gamesStarted);
		console.log(winPc);
		console.log(currStreak);
		console.log(maxStreak);
		console.log(hardPc);*/
		/*for(var i = 0; i < 6; i++){
			console.log((i+1)+": "+dist[i]);
		}*/


		//could scale graph maybe to have max width on highest but is fine for now

		var statsText = "<@"+message.author.id+">\'s ServerWordle Stats\n";
		statsText += "Played: "+gamesStarted+ " | Win %: "+winPc+" | Streak: "+currStreak+" | Max: "+maxStreak+" | Hard %: "+hardPc+"\n";
		statsText += "Guess distribution:\n```"
		for(var i = 0; i < 6; i++){
			statsText+=(i+1)+": "
			if(totalDist > 0) {statsText += "|".repeat((dist[i]/totalDist)*50);}
			if(dist[i]>0){
				statsText += " ("+dist[i]+")";
			}
			statsText+="\n";
		}
		statsText+="```";
		//try {
			let channel = Array.from(bot.channels.cache.filter(e => (e.guildId == message.guildId) && (e.name == "wordle-bot")))[0][1];
			
			/*const exampleEmbed = new MessageEmbed()
			.setTitle(message.author.username+'\'s Stats \u2800'+Array(50).join("\u2800"))
			.setThumbnail('')
			.setDescription(Array(40).join("_."))
			.addFields(
				{name: "Played", value: String(gamesStarted), inline: true},
				{name: "Win %", value: String(winPc), inline: true},
				{name: "Hard %", value: String(hardPc), inline: true},
				{name: "Streak", value: String(currStreak), inline: true},
				{name: "Max streak", value: String(maxStreak), inline: true},

			);*/
			//.setFooter({text: "\u2800".repeat(40)+"|"});

			channel.send(statsText);
		//}
		//catch(err){
			//no channel found
		//	bot.users.fetch(message.author.id).then((user) => user.send("\"wordle-bot\" channel not found on your server. Could not publish result. Please contact your server admin."));
		//}

		
	}
	
	if(message.channel.name == "wordle-bot" && message.content == "!join" && message.author.bot == false) {
		
		//
		const resultj0 = await query(`SELECT DISTINCT user FROM game_log WHERE user = `+message.author.id+` AND server = `+message.guildId+`;`);
		if(resultj0.length > 0) {
			//already registered so ignore
			console.log(message.author.username+" tried to join but is already a member on server id "+message.guildId);
			message.author.send("You have already joined on this server. DM the bot each day to play.");
			return;
		}
		else {
			//new user
			//first check if new server and if so create first answer
			var resultj1 = await query(`SELECT DISTINCT server FROM answers`);
			if(resultj1.filter(e => e.server === message.guildId).length == 0) {
				//create new wordle answer for this server

				console.log("Created first wordle for server id "+message.guildId);

				const wordle = AnswerList[Math.floor(Math.random()*AnswerList.length)].toUpperCase();
				await query(`INSERT INTO answers values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+message.guildId+`','`
							+wordle+`','`
							+1+`');`);
			}


			//create new game for user
			console.log("Creating first game for "+message.author.username+ " on server "+message.guildId);
			const resultj2 = await query(`SELECT a.* FROM answers a`+
								   ` WHERE a.id = (SELECT MAX(a2.id) from answers a2 WHERE a2.server = `+
								   +message.guildId+`);`);
			//console.log(resultj2);
			const wordleNumber = resultj2[0].wordle_number;

			await query(`INSERT INTO game_log values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+message.guildId+`','`
							+message.author.id+`','`
							+wordleNumber+`','`
							+"START"+`',`
							+`NULL`+`,`
							+`NULL`+`,`
							+`NULL`+`);`);

			message.author.send("Welcome to ServerWordle. Correct letters in wrong place are displayed as blue, correct letters in the right place are green."
								+"\nOptional: your attempt will be marked as hard (*) if you always use any green and blue hints in subsequent guesses."
								+"\nView stats by sending !stats in the #wordle-bot channel."
								+"\n\nServerWordle #"+wordleNumber+". Please send your first guess...\n");
			return;

		}
	}
	


	if(message.channel.type == 'DM' && !message.author.bot) {
			
		const resultU = await query(`SELECT DISTINCT user FROM game_log WHERE user = `+message.author.id+`;`);
				
		if(resultU.length == 0) {
			//If user not found in the game_log table then respond:
			console.log("Unregistered user "+message.author.username+" DMd bot");
			message.author.send("User not found. Please first send \"!join\" in the #wordle-bot channel of your server");
			return;
		}

		else {
			//user exists
			//check if user has completed their current wordle, or if there is a new wordle available
			//get latest entry for user in game log
			
			const result = await query(`SELECT g.* FROM game_log g`+
								   ` WHERE g.id = (SELECT MAX(g2.id) from game_log g2 WHERE g2.user = `+
								   +message.author.id+`);`);

			
			if(result[0].event_type !== "START") {
				//user has finished their last game. Check if there is a new wordle available  (latest one).
				var serverId = result[0].server;
				const result2 = await query(`SELECT a.* FROM answers a`+
								   ` WHERE a.id = (SELECT MAX(a2.id) from answers a2 WHERE a2.server = `+
								   +serverId+`);`);
				
				if(result2[0].wordle_number > result[0].wordle_number) {
					//there is a new wordle. make new entry in game log to start player on latest wordle
					await query(`INSERT INTO game_log values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+result2[0].server+`','`
							+message.author.id+`','`
							+result2[0].wordle_number+`','`
							+"START"+`',`
							+`NULL`+`,`
							+`NULL`+`,`
							+`NULL`+`);`);
					console.log("User "+message.author.username+" started wordle number "+result2[0].wordle_number+" on server "+result2[0].server);
					message.author.send("ServerWordle #"+result2[0].wordle_number+". Please send your first guess...");
					return;

				} else {
					//there is no new wordle try again later
					message.author.send("You have already completed today's ServerWordle (#"+result2[0].wordle_number+"). Please try again tomorrow by DMing the bot.");
					return;
				}
			}

			//guess_log
			//id 	date 	server 	user 	wordle_number 	event_type 	num_guesses 	difficulty 	streak
			
			//get details for game in progress which is not necessarily the latest wordle
			var serverId = result[0].server;
			var wordleNumber = result[0].wordle_number;

			const result3 = await query(`SELECT a.* FROM answers a`+
								   ` WHERE a.server = `+serverId+` AND a.wordle_number = `+
								   +wordleNumber+`;`);


			if(result3.length == 0) {
				console.log("Error #7: game log mismatch for user "+message.author.username+" on server "+serverId);
				message.author.send("Error #7: game log mismatch. Please contact admin");
				return;
			}
			var wordle = result3[0].answer;
			
			
			//work out game state from guesses
			
			const result4 = await query(`SELECT * FROM guess_log WHERE user = `+message.author.id+` AND wordle_number = `+wordleNumber+`;`);
			
			const userState = result4.length+1;

			//console.log("userstate: "+userState);
			switch(userState) {

				case UserStates.Guess1:
				case UserStates.Guess2:
				case UserStates.Guess3:
				case UserStates.Guess4:
				case UserStates.Guess5:
				case UserStates.Guess6:
					 
					if(GuessList.includes(message.content.toLowerCase())) {
						
						//a valid guess was sent

						console.log("User "+message.author.username+" submitted valid guess number "+userState+" for wordle number "+wordleNumber+" on server "+serverId);
						message.author.send("ServerWordle #"+wordleNumber+".");


						//make record in guess log
						var dateRecord = moment().format('YYYY-MM-DD HH:mm:ss');
						await query(`INSERT INTO guess_log values(NULL,'`
								+dateRecord+`','`
								+serverId+`','`
								+message.author.id+`','`
								+wordleNumber+`','`
								+message.content.toUpperCase()+`','`
								+getColours(message.content.toUpperCase(),wordle)+`');`);

						var userGuesses = [];
						var guessColours = [];

						//same query as result 4 but now with updated guess
						const result5 = await query(`SELECT * FROM guess_log WHERE user = `+message.author.id+` AND wordle_number = `+wordleNumber+`;`);
						
						for(var i = 0; i < result5.length; i++) {
							userGuesses.push(result5[i].guess);
							guessColours.push(result5[i].colours);
						}

						
						var buttonRows = []
						for(var i = 0; i < userGuesses.length-1; i++) {
							buttonRows.push(generateButtons(userGuesses[i],getColours(userGuesses[i],wordle),i));
						}
						if(userState!==UserStates.Guess1){
							message.author.send({content: "Past guesses:", components: buttonRows});
						}
						//console.log(userGuesses);
						message.author.send({content: "Your guess ("+userState+"/6):",
											components: [ generateButtons(userGuesses[userGuesses.length-1],getColours(userGuesses[userGuesses.length-1],wordle),6) ]});
						
						

						if(message.content.toUpperCase() == wordle) {
							message.author.send("Well done! You correctly guessed ServerWordle #"+wordleNumber+" in "+userState+" guesses. Well done!");
							//make record in game log - win
							const difficulty = getDifficulty(userGuesses,guessColours,wordle);

							console.log("User "+message.author.username+" won with "+userState+"guesses for wordle number "+wordleNumber+" on server "+serverId);
						

							await query(`INSERT INTO game_log values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+serverId+`','`
							+message.author.id+`','`
							+wordleNumber+`','`
							+"WIN"+`','`
							+userState+`','`
							+difficulty+`','`
							+await calcStreak(message.author.id,serverId,wordleNumber)+`');`);

							message.author.send("DM this bot with any message to check for a new wordle.");
							publishAnswer("WIN",wordleNumber,userState,guessColours,difficulty,message.author.id,serverId);
							
						}
						else if(userState == UserStates.Guess6) {
							message.author.send("Unlucky! You didn't get ServerWordle #"+wordleNumber+". The correct answer was ||"+wordle+"||.");
							//make record in game log - win
							const difficulty = getDifficulty(userGuesses,guessColours,wordle);

							console.log("User "+message.author.username+" lost with "+userState+"guesses for wordle number "+wordleNumber+" on server "+serverId);
						

							await query(`INSERT INTO game_log values(NULL,'`
							+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
							+serverId+`','`
							+message.author.id+`','`
							+wordleNumber+`','`
							+"LOSE"+`','`
							+userState+`','`
							+difficulty+`','`
							+0+`');`);

							message.author.send("DM this bot with any message to check for a new wordle.");
							publishAnswer("LOSE",wordleNumber,userState,guessColours,difficulty,message.author.id,serverId);
							
						}
						else{
							var lettersRemaining = getRemainingLetters(userGuesses,wordle);

	  						message.author.send("Remaining letters:\n"+lettersRemaining);

						}
						

					}
					else{
						//invalid word
						message.author.send("Sorry that wasn't a valid word. Please enter a different 5-letter word guess.")
						  .then(msg => {
						    setTimeout(() => msg.delete(), 5000)
						  })
						  .catch(console.error);
						
					}
					
					break;
			}


		}
	}

});

async function publishAnswer(winLose,wordleNumber,userState,guessColours,difficulty,user,serverId) {

	/* example
	Wordle 244 4/6*
	@user
	⬜⬜🟩⬜🟨
	🟨⬜🟩🟨⬜
	🟨⬜🟩🟨⬜
	🟩🟩🟩🟩🟩


	White ⬜
	Green 🟩
	Yellow 🟨
	Blue 🟦

	*/

	//add in a notification for streaks

	let guessString = userState;
	if( winLose == "LOSE") {guessString = "X";}
	let messageString = "ServerWordle #"+wordleNumber+" "+guessString+"/6"
	if(difficulty == "HARD") {messageString += "*";}
	messageString += "\n<@" + user + ">";

	let streak = await query(`SELECT * FROM game_log WHERE user = `+user+` AND wordle_number = `+wordleNumber+` AND streak > 2;`);
	if(streak.length > 0) {
		//there was a win streak of 3 or greater
		messageString += " - "+streak[0].streak+" win streak!";
	}

	for(var i = 0; i < guessColours.length; i++) {
		messageString += "\n"
		
		for(var j = 0; j < 5; j++) {
			let char = "";
			switch(guessColours[i].split("")[j]) {
				case "B":
					char = "⬜"
					break;
				case "Y":
					char = "🟦";
					break;
				case "G":
					char = "🟩";
					break;
			}
			messageString += char;
		}

	}

	
	//look for appropriate channel to publish result
	
	try {
		let channel = Array.from(bot.channels.cache.filter(e => (e.guildId == serverId) && (e.name == "wordle-bot")))[0][1];
		channel.send(messageString);
	}
	catch(err){
		//no channel found
		bot.users.fetch(user).then((user) => user.send("\"wordle-bot\" channel not found on your server. Could not publish result. Please contact your server admin."))
	}
    
}

async function aliveStatus(){
	console.log("ALIVE at "+moment().format('YYYY-MM-DD HH:mm:ss'));
}


async function refreshAnswers() {
	
	//get list of latest wordle entries for each server
	let result = await query(`SELECT a.* from answers a WHERE id IN (SELECT MAX(id) FROM answers GROUP BY server);`);
	let now = moment();
	//console.log("checking answers");
	//console.log(result);
	//console.log(moment().format('YYYY-MM-DD HH:mm:ss'));
	for(var i = 0; i < result.length; i++) {
		
		let then = moment(result[i].date);
		
		if(now.diff(then.endOf('day'))>0) {
		//if(now.diff(then)>=0) { //for debug purposes
			
			//filter out last 300 guesses for this server
			let pastAnswers = await query(`SELECT * FROM answers WHERE server = ` + result[i].server + ` ORDER BY id DESC LIMIT 300;`);
		    let pastArr = [];
		    for(var j = 0; j < pastArr.length; i++){
		    	pastArr.push(pastAnswers[j].answer.toLowerCase());

		    }

			const wordle = AnswerList.filter(e => !pastArr.includes(e))[Math.floor(Math.random()*(AnswerList.length-pastArr.length))].toUpperCase();
			await query(`INSERT INTO answers values(NULL,'`
						+moment().format('YYYY-MM-DD HH:mm:ss')+`','`
						+result[i].server+`','`
						+wordle+`','`
						+(result[i].wordle_number+1)+`');`);
		}

		//console.log("end of day: "+moment().endOf('day').format('YYYY-MM-DD HH:mm:ss'));

	}

}

function getDifficulty(guesses,colours,wordle) {
	
	if(guesses.length==1){return "HARD";} 
	else {

		for(var i = 1; i < guesses.length; i++){
			//loop through each guess and compare to previous

			requiredLetters = [];
			requiredPositions = [];

			for(var j = 0; j < 5; j++){
				if(colours[i-1].split("")[j] !== "B") {
					//non-black letter so add to required list
					requiredLetters.push(guesses[i-1].split("")[j]);
				}
				if(colours[i-1].split("")[j] == "G") {
					requiredPositions.push(j);
				}
			}

			//have we used up all the required letters?
			let letters = guesses[i].split("");
			for(var k = 0; k < 5; k++) {
				if(requiredLetters.indexOf(letters[k])>-1) {
					//remove letter from required array
					requiredLetters.splice(requiredLetters.indexOf(letters[k]),1);
				}
			}

			//failed to use all letters
			if(requiredLetters.length > 0) {return "EASY";}

			//check green letters in correct position
			for(var l = 0; l < requiredPositions.length; l++){
				if(letters[requiredPositions[l]] !== guesses[i-1].split("")[requiredPositions[l]]){
					return "EASY";
				}
			}


		}
		//if not returned: must be hard

		return "HARD";
	}


	
}

async function calcStreak(user,server,wordleNumber) {
	//called if user has won
	const result = await query(`SELECT * FROM game_log WHERE user = `+user+` AND server = `+server+` AND event_type = "WIN" ORDER BY wordle_number DESC;`);
	if(result.length > 0) {
		//get latest wordle won - the first entry as we sort descending
		let wnum = result[0].wordle_number;
		if((wordleNumber - wnum) == 1) {
			//user has completed the next wordle in sequence. Increment streak.
			return result[0].streak+1;
		}
	}
	//user has not got a sequence of wins - so return just 1 for this current win
	return 1;
}

//todo daily reminder

function generateButtons(word, colours, offset=0) {
	var row = new MessageActionRow()
	for(var i = 0; i < 5; i++) {
		row.addComponents(
			new MessageButton()
			.setCustomId('test'+i+offset*5)
			.setLabel(word[i])
			.setStyle(colours[i] == 'B' ? 'SECONDARY' : (colours[i] == 'Y' ? 'PRIMARY' : 'SUCCESS'))
			//.setDisabled(true)
			);
	}		
		return row;
}

function getColours(guess, wordle) {

	var guessLetters = guess.split("");
	var answerLetters = wordle.split("");
	var colours = "BBBBB".split("");

	//array to remove letters from so that we don't colour too many
	var uncolouredLetters = wordle.split("");

	//console.log(answerLetters);
	//console.log(guessLetters);
	for(var i = 0; i < answerLetters.length; i++){
		//console.log(i);

		if(answerLetters[i] == guessLetters[i] && uncolouredLetters.includes(guessLetters[i])) {
			colours[i] = "G";
			var index = uncolouredLetters.indexOf(guessLetters[i]);
			if(index > -1) {
				uncolouredLetters.splice(index,1);
			}
		}

	}
	//second pass for Y (before this guessing e.g. AMAZE for EMAIL led to middle A not showing green)
	for(var i = 0; i < answerLetters.length; i++){
		if(answerLetters.includes(guessLetters[i]) && colours[i] !== "G"){
				
				var index = uncolouredLetters.indexOf(guessLetters[i]);
				if(index > -1) {
					//only colour if we have possible letters left in the word
					colours[i] = "Y";
					uncolouredLetters.splice(index,1);
				}
			}
	}
	//console.log(colours.join(""));
	return colours.join("");

}

function getRemainingLetters(guesses,wordle) {

	var lettersRemaining = "```"+
						   "q w e r t y u i o p\n"+
						   " a s d f g h j k l\n"+
						   "  z x c v b n m"+
						   "```";

	var colours = [];
	for(var i = 0; i < guesses.length; i++){
  		colours.push(getColours(guesses[i],wordle));
  	}

  	//change green or yellow
  	for(var i = 0; i < colours.length; i++) {
  		for(var j = 0; j<5; j++) {
  			if(colours[i].charAt(j)!=="B") {
				lettersRemaining = lettersRemaining.replace(guesses[i].charAt(j).toLowerCase(),guesses[i].charAt(j));
			}
		}
	}
	//change black
	for(var i = 0; i < colours.length; i++) {
  		for(var j = 0; j<5; j++) {
  			if(colours[i].charAt(j)=="B") {
				lettersRemaining = lettersRemaining.replace(guesses[i].charAt(j).toLowerCase(),"-");
			}
		}
	}

	return lettersRemaining;

}

bot.on('interactionCreate', interaction => {
	if (!interaction.isButton()) return;
	//console.log(interaction);
	//unteraction.deferReply({ ephemeral: true })
	
});


function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}


bot.login(config.token);
