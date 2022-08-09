const util = require('util');
const config = require('./config.json');
const moment = require('moment');

const {createConnection} = require('mysql2');
let con = createConnection(config.mysql);

const runMySQLQuery = util.promisify(con.query).bind(con);

console.log("loaded database js file");
function connect(func){
    con.connect(func);
}

async function qryUserServerGameRecords(userId, serverId) {
    return runMySQLQuery(`SELECT * FROM game_log WHERE user = ${userId} AND server = ${serverId};`);
}

async function qryUserServerGamesStarted(userId, serverId) {
    return runMySQLQuery(`SELECT * FROM game_log WHERE user = ${userId} AND server = ${serverId} AND event_type = "START";`);
}

async function qryUserServerGamesWon(userId, serverId) {
    return runMySQLQuery(`SELECT * FROM game_log WHERE user = ${userId} AND server = ${serverId} AND event_type = "WIN";`);
}

async function qryUserServerCurrentWinStreak(userId, serverId) {
    return runMySQLQuery(`SELECT g.* FROM game_log g WHERE g.id = (SELECT MAX(g2.id) from game_log g2 WHERE g2.server = ${serverId} AND g2.user = ${userId} AND NOT event_type = "START");`);
}

async function qryUserServerMaxWinStreak(userId, serverId) {
    return runMySQLQuery(`SELECT IFNULL(MAX(g1.streak),0) AS streak FROM (SELECT * FROM game_log WHERE user = ${userId} AND server = ${serverId}) g1;`);
}

async function qryUserServerHardGamesCompleted(userId, serverId) {
    return runMySQLQuery(`SELECT * FROM game_log WHERE user = ${userId} AND server = ${serverId} AND difficulty = "HARD";`);
}

async function qryServersWithAnswers() {
    return runMySQLQuery(`SELECT DISTINCT server FROM answers`);
}

async function qryServerLatestAnswer(serverId) {
    return runMySQLQuery(`SELECT a.* FROM answers a WHERE a.id = (SELECT MAX(a2.id) from answers a2 WHERE a2.server = ${serverId});`);
}

async function qryAllServersLatestAnswers() {
    return runMySQLQuery(`SELECT a.* from answers a WHERE id IN (SELECT MAX(id) FROM answers GROUP BY server);`);
}

async function qryUserGameLogs(userId) {
    return runMySQLQuery(`SELECT DISTINCT user FROM game_log WHERE user = ${userId};`);
}

async function qryUserServersJoined(userId) {
    return runMySQLQuery(`SELECT DISTINCT server FROM game_log WHERE user = ${userId} ORDER BY server ASC`);
}

async function qryUserLatestGuessLog(userId) {
    return runMySQLQuery(`SELECT g.* from guess_log g WHERE id IN (SELECT MAX(id) FROM guess_log WHERE user = ${userId});`);
}

async function qryUserLatestGameLog(userId) {
    return runMySQLQuery(`SELECT g.* FROM game_log g WHERE g.id = (SELECT MAX(g2.id) from game_log g2 WHERE g2.user = ${userId});`);
}

async function qryServerAnswerByWordleNumber(serverId, wordleNumber) {
    return runMySQLQuery(`SELECT a.* FROM answers a WHERE a.server = ${serverId} AND a.wordle_number = ${wordleNumber};`);
}

async function qryUserServerGuessLogSpecific(userId, serverId, wordleNumber) {
    return runMySQLQuery(`SELECT * FROM guess_log WHERE user = ${userId} AND wordle_number = ${wordleNumber} AND server = ${serverId}`);			
}

async function qryServerLastNAnswers(serverId, n) {
    return runMySQLQuery(`SELECT * FROM answers WHERE server = ${serverId} ORDER BY id DESC LIMIT ${n};`);
}

async function qryUserGameLogsNotJoin(userId) {
    return runMySQLQuery(`SELECT * FROM game_log WHERE user = ${userId} AND event_type <> "JOIN";`);
}

async function qryServerUniqueUsers(serverId) {
    return runMySQLQuery(`SELECT DISTINCT user FROM game_log WHERE server = ${serverId};`);
}

async function qryCompletedGames() {
    return runMySQLQuery(`SELECT * FROM game_log WHERE (event_type = "WIN" OR event_type = "LOSE");`);
}

async function qryCustomChannels() {
    return runMySQLQuery(`SELECT * FROM custom_channels;`);
}

async function qryServerCustomChannel(serverId) {
    return runMySQLQuery(`SELECT * FROM custom_channels WHERE server = ${serverId}`);
}

//insert queries 

async function insertAnswerRow(serverId, answer, wordleNumber) {
    return runMySQLQuery(`INSERT INTO answers values(NULL,'${moment().format('YYYY-MM-DD HH:mm:ss')}','${serverId}','${answer}','${wordleNumber}');`);
}

async function insertGameLogStart(userId, serverId, wordleNumber) {
    return insertGameLogGeneric(userId, serverId, wordleNumber, "START");
}

async function insertGameLogJoin(userId, serverId, wordleNumber) {
    return insertGameLogGeneric(userId, serverId, wordleNumber, "JOIN");
}

async function insertGameLogWin(userId, serverId, wordleNumber, numGuesses, difficulty, streak) {
    return insertGameLogGeneric(userId, serverId, wordleNumber, "WIN", `'${numGuesses}'`, `'${difficulty}'`, `'${streak}'`);
}

async function insertGameLogLose(userId, serverId, wordleNumber, difficulty) {
    return insertGameLogGeneric(userId, serverId, wordleNumber, "LOSE", `'6'`, `'${difficulty}'`, `'0'`);
}

async function insertGuessLog(userId, serverId, wordleNumber, guess, colours) {
    return runMySQLQuery(`INSERT INTO guess_log values(NULL,'${moment().format('YYYY-MM-DD HH:mm:ss')}','${serverId}','${userId}','${wordleNumber}','${guess}','${colours}');`);
}

async function updateCustomChannel(serverId, newChannelId) {
    await runMySQLQuery(`DELETE FROM custom_channels WHERE server = ${serverId};`);
    await runMySQLQuery(`INSERT INTO custom_channels values(NULL,'${moment().format('YYYY-MM-DD HH:mm:ss')}','${serverId}','${newChannelId}');`);
}

//private

async function insertGameLogGeneric(userId, serverId, wordleNumber, eventType, numGuesses="NULL", difficulty="NULL", streak="NULL") {
    //| id  | date                | server             | user               | wordle_number | event_type | num_guesses | difficulty | streak
    return runMySQLQuery(`INSERT INTO game_log values(NULL,'${moment().format('YYYY-MM-DD HH:mm:ss')}','${serverId}','${userId}','${wordleNumber}','${eventType}',${numGuesses},${difficulty},${streak});`);
}

module.exports = {
    connect,
    qryUserServerGameRecords,
    qryUserServerGamesStarted,
    qryUserServerGamesWon,
    qryUserServerCurrentWinStreak,
    qryUserServerMaxWinStreak,
    qryUserServerHardGamesCompleted,
    qryServersWithAnswers,
    qryServerLatestAnswer,
    qryUserGameLogs,
    qryUserServersJoined,
    qryUserLatestGuessLog,
    qryUserLatestGameLog,
    qryServerAnswerByWordleNumber,
    qryUserServerGuessLogSpecific,
    qryAllServersLatestAnswers,
    qryServerLastNAnswers,
    qryUserGameLogsNotJoin,
    qryServerUniqueUsers,
    qryCompletedGames,
    qryCustomChannels,


    insertAnswerRow,
    insertGameLogJoin,
    insertGameLogStart,
    insertGameLogWin,
    insertGameLogLose,
    insertGuessLog,
    updateCustomChannel,
}