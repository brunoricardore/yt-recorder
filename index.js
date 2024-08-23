const http = require('http');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');


// 1080p
let livestreamUrl = '';


//720p
const livestreamUrl2 = 'https://manifest.googlevideo.com/api/manifest/hls_playlist/expire/1724359379/ei/c07HZujbJNCS-LAPvrfJiA0/ip/191.35.234.177/id/MouIUCFwdRs.1/itag/95/source/yt_live_broadcast/requiressl/yes/ratebypass/yes/live/1/sgoap/gir%3Dyes%3Bitag%3D140/sgovp/gir%3Dyes%3Bitag%3D136/rqh/1/hdlc/1/hls_chunk_host/rr3---sn-b8u-nw3e.googlevideo.com/xpc/EgVo2aDSNQ%3D%3D/playlist_duration/30/manifest_duration/30/spc/Mv1m9ldh6dvp3Qdmi-uCc_ijACA31C0VY6Xi9dP6-6qbvrKBo-vsf8NxfJwSmpM/vprv/1/playlist_type/DVR/initcwndbps/826250/mh/r6/mm/44/mn/sn-b8u-nw3e/ms/lva/mv/m/mvi/3/pl/21/dover/11/pacing/0/keepalive/yes/mt/1724337650/sparams/expire,ei,ip,id,itag,source,requiressl,ratebypass,live,sgoap,sgovp,rqh,hdlc,xpc,playlist_duration,manifest_duration,spc,vprv,playlist_type/sig/AJfQdSswRQIgIdNzfrN_OUb7nmJIPFWYxo0qyfaDzOy8P8o_Ih0sVMcCIQD8xfNMakO1q26sM_LQEObZTPdTFF3Eh4FNRPWo-5SSQw%3D%3D/lsparams/hls_chunk_host,initcwndbps,mh,mm,mn,ms,mv,mvi,pl/lsig/AGtxev0wRQIgPX7eD4tzXR56AbcwYZKhx35cVJ_sqrdNujhGloisd9kCIQD03ZE6y99rxX3t8wpyiw8kpeoPVjbBvZxGJQWsYubozA%3D%3D/playlist/index.m3u8';

const baseOutputDirectory = 'D:\\BUIU-TENNIS-VIDEOS';

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

const getCurrentDayOfWeek = () => new Date().getDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday


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
    getHLSURL();

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

    start() {
        cron.schedule('0 7-22 * * 1-5', () => {
            console.log(getDayLogMessage());
            this.videoExtractor.extractHourSegment();
        });

        // cron.schedule('29 * * * 1-5', () => {
        //     console.log(getDayLogMessage());
        //     this.videoExtractor.extractHourSegment();
        // });

        cron.schedule('0 */5 * * *', () => {
            console.log('Running M3U8 URL update');
            getHLSURL();
        });
    }
}

// Class handling video extraction
class VideoExtractor {
    // Method to build and execute FFmpeg command
    extractHourSegment() {

        console.log('video URL');
        console.log(livestreamUrl);

        const hour = getCurrentHour();

        const currentDate = getCurrentDate();
        const outputDir = path.join(baseOutputDirectory, currentDate);
        createDirectoryIfNotExists(outputDir);

        const outputFileName = path.join(outputDir, `${generatePrefix()}_${formatHour(hour)}hrs.mp4`);

        ffmpeg(livestreamUrl)
            .setFfmpegPath(require('ffmpeg-static'))
            // .setStartTime(startTime)
            .duration(3600) // Duration is 1 hour
            // .duration(120) // Duration is 2 minutes
            .output(outputFileName)
            .on('start', (commandLine) => {
                logMessage(`Start Processing new [${generatePrefix()}] video`)
                // logMessage(`FFmpeg command line: ${commandLine}`);
            })
            .on('progress', (progress) => {
                // logMessage(`Processing progress: ${progress.percent}% done`);
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

function getHLSURL() {
    try {

        ytdl.getInfo(VIDEO_URL)
            .then(info => {
                const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
                const m3u8Format = formats.find(format => format.qualityLabel.includes('720'));

                if (!m3u8Format) throw new Error('No Format available')

                logMessage('Format found', + m3u8Format.qualityLabel);
                livestreamUrl = m3u8Format.url;
            })

    } catch (err) {
        console.log(err);
    }
}

startLiveServer();

