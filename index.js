const http = require('http');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');


// 720
let livestreamUrl = '';

const baseOutputDirectory = './BUIU-TENNIS-VIDEOS';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getDayLogMessage = () => {
    const now = new Date();
    const day = daysOfWeek[now.getDay()];
    const hour = now.getHours();

    return (`Task is running on ${day} at ${hour}:00`);
}

const formatHour = (hour) => (hour < 10 ? `0${hour}` : hour);

const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = formatHour(now.getMonth() + 1);
    const day = formatHour(now.getDate());
    return `${day}-${month}-${year}`;
};

const getCurrentHour = () => new Date().getHours(); // Current hour in 24-hour format

const generatePrefix = () => {
    const dayOfWeek = new Date().getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    let prefix;
    let startHour, endHour;

    switch (dayOfWeek) {
        case 0: // Sunday
        case 6: // Saturday
            prefix = 'rotativo';
            startHour = 8;
            endHour = dayOfWeek === 6 ? 22 : 20; // Saturday ends at 22, Sunday ends at 20
            break;
        default: // Monday to Friday
            prefix = 'treino';
            startHour = 7;
            endHour = 23;
            break;
    }

    return `${prefix}`
}

const startLiveServer = () => {
    const videoExtractor = new VideoExtractor();
    const scheduler = new Scheduler(videoExtractor);

    scheduler.start();

    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('Live stream recording server is running.\n');
        res.end();
    }).listen(8080, () => {
        console.log('Server is listening on port 8080');
    });

};

const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

// Utility function to create directory if it doesn't exist
const createDirectoryIfNotExists = (dirPath) => {
    console.log(dirPath);
    if (!fs.existsSync(dirPath)) {
        console.log(`folder ${dirPath} not there, creating this`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

class Scheduler {
    constructor(videoExtractor) {
        this.videoExtractor = videoExtractor;
    }

    async start() {

        if (livestreamUrl === '' || lastTimeStamp === 0 ) {
            await getHLSURL();
        }

        // this.videoExtractor.extractHourSegment();

        // cron.schedule('*/3 * * * *', () => {
        //     console.log('Running extractHourSegment');
        //     this.videoExtractor.extractHourSegment();
        // });

        cron.schedule('0 7-22 * * 1-5', () => {
            setTimeout(() => {
                console.log(getDayLogMessage());
                this.videoExtractor.extractHourSegment();
            }, 20_000);
        });

        // cron.schedule('0 */5 * * *', () => {
        //     console.log('Running M3U8 URL update');
        //     getHLSURL();
        // });
    }
}

// Class handling video extraction
class VideoExtractor {
    // Method to build and execute FFmpeg command
    async extractHourSegment() {

        const dateNow = new Date();
        const nowTimestamp = dateNow.getTime();

        // console.log(lastTimeStamp, nowTimestamp);

        if (livestreamUrl === ''
            ||
            lastTimeStamp > nowTimestamp
        ) {
            logMessage(`should request new hls request`);
            await getHLSURL();
        }

        const getCurrentHour = () => new Date().getHours(); // Current hour in 24-hour format
        const getCurrentMinute = () => new Date().getMinutes(); // Current minute

        const formatHour = (hour) => (hour < 10 ? `0${hour}` : hour);
        const formatMinute = (minute) => (minute < 10 ? `0${minute}` : minute);

        const hour = getCurrentHour();

        const currentDate = getCurrentDate();
        const outputDir = path.join(baseOutputDirectory, currentDate);
        createDirectoryIfNotExists(outputDir);

        const outputFileName = path.join(outputDir, `${generatePrefix()}_${formatHour(hour)}__${nowTimestamp}.mp4`);

        ffmpeg(livestreamUrl)
            .setFfmpegPath(require('ffmpeg-static'))
            // .setStartTime(startTime)
            .duration(3590) // Duration is 1 hour
            // .duration(120) // Duration is 2 minutes
            .output(outputFileName)
            .on('start', (commandLine) => {
                logMessage(`Start Processing new [${generatePrefix()}] video`)
                // logMessage(`FFmpeg command line: ${commandLine}`);
            })
            .on('progress', (progress) => {
                console.log(`[${formatHour(hour)}:${formatMinute(getCurrentMinute())}] Recording progress: ${progress.timemark}`);
            })
            .on('end', () => {
                logMessage('Finished processing.');
                logMessage(`Saved to: ${outputFileName}`);
                // saveFile(outputFilePath);
            })
            .on('error', (err) => {
                console.log(err);
                logMessage(`An error occurred: ${err.message}`);
            })
            .run();
    }
}

const VIDEO_URL = 'https://www.youtube.com/watch?v=MouIUCFwdRs';
let lastTimeStamp = 0;

async function getHLSURL() {
    const info = await ytdl.getInfo(VIDEO_URL);
    const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
    const m3u8Format = formats.find(format => format.qualityLabel.includes('720'));

    if (!m3u8Format) throw new Error('No Format available');


    logMessage('Format found', + m3u8Format.qualityLabel);
    livestreamUrl = m3u8Format.url;

    const expireMatch = livestreamUrl.match(/\/expire\/(\d+)/);
    const expireNumber = expireMatch ? expireMatch[1] : null;

    lastTimeStamp = expireNumber * 1000;
}

startLiveServer();

