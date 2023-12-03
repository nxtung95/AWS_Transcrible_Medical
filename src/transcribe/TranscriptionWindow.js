import React, {Component} from "react";
import uuid from 'uuid'
import {closeSocket, streamAudioToWebSocket} from './websocketUtils';
import {detectEntity} from '../comprehend/DetectEntities';
import Transcript, {tonkenizeTranscript} from './Transcript'
import * as _ from 'lodash';
import {getMicAudioStream} from "./audio";

export default class TranscriptionWindow extends Component {

    constructor(props) {
        super(props);

        this.state = {
            recording: false,
            id: uuid.v4(),
            audioStream: undefined,
            transcript: [], // list of finalized transcript
            transcriptBoxs: [], // list of boxed transcript words
            partialTranscript: "", // last chunk of transcript, which has not be finalized 
            entities: [],
            segments: []
        }
    }

    async componentDidMount() { }

    async startRecord() {
        // TODO: clean up transcript and entities
        this.setState({
            transcript: [], // list of finalized transcript
            transcriptBoxs: [], // list of boxed transcript words
            segments: [],
            entities: [],
            partialTranscript: "" // last chunk of transcript, which has not be finalized
        }, _ => {

            return getMicAudioStream()
                .then((stream) => {
                    window.localStream = stream;
                    return stream;
                }).then(micAudioStream => {
                    console.log(`Browser support microphone audio input`);

                    // Start Streaming websocket connection
                    streamAudioToWebSocket(micAudioStream, this.updateTranscript, (error) => {
                        console.log(error)
                    });

                    this.setState({
                        audioStream: micAudioStream,
                        recording: true,
                    });
                    return micAudioStream;
                }).catch(err => {
                    // Users browser doesn't support audio.
                    // Add your handler here.
                    console.log(err);
                })
        })
    }

    async stopRecord() {
        let {transcript } = this.state;

        // close web socket connection
        closeSocket();

        let allTranscript = this.combineTranscript(transcript);
        let response = await detectEntity(allTranscript);

        this.setState({
            recording: false,
            entities: response.Entities
        });
    }



    combineTranscript(transcript) {
        let allTranscript = _.reduce(transcript, (acc, v, i) => {
            acc = `${acc}  ${v}`; // concat transcript
            return acc;
        }, " "); // empty string as inital accumulator
        return allTranscript;

    }

    updateTranscript = async (newTranscript) => {
        let { results, text, isPartial } = newTranscript;

        /**
         * Temperary Hack for Re:Invent demo
         */
        text = text.replace("you was admitted", "he was admitted");

        if (isPartial) { // update last chuck of partial transcript
            this.setState({
                partialTranscript: text
            })
        } else { // append finalized transcript
            let { transcript, transcriptBoxs, segments, entities } = this.state;
            transcript.push(text);

            // Tokenize transcript
            var { wordTokens, segmentEntities } = await tonkenizeTranscript(text, results);


            var segment = {
                startTime: results[0].StartTime,
                words: wordTokens,
            }

            segments.push(segment);

            this.setState({
                transcriptBoxs: transcriptBoxs,
                transcript: transcript,
                partialTranscript: "",
                entities: entities.concat(segmentEntities),
                segments
            });
        }
    }

    render() {
        const { recording, partialTranscript, entities, segments, } = this.state;

        console.log(JSON.stringify(segments))
        console.log(JSON.stringify(entities))
        /**
         * Do not render if audioStream is not ready yet
         */
        // if (!audioStream) {
        //     return null;
        // }

        return (
            <div class="m-3">
                <div class="row d-flex mb-3 pl-3">
                    <button
                        class="btn btn-primary mr-3"
                        onClick={() => { recording ? this.stopRecord() : this.startRecord(); }} >
                        {recording ? 'Stop Dictation' : 'Start Dictation'}
                    </button>
                    <button class="btn btn-primary" type="button"
                        onClick={() => { this.clearTranscript() }}
                    >Clear transcript
                    </button>
                </div>

                <div class="row pl-3">
                    <div class="border col-8" style={{ 'min-height': '200px', 'min-weight': '300px' }}>
                        {
                            _.map(segments, (seg, i) => {
                                return (
                                    <div class="text-left mt-1 mr-n3" style={{ 'fontWeight': 'normal' }} key={i}>
                                        <Transcript
                                            words={seg.words}
                                        >
                                        </Transcript>
                                    </div>);
                            })
                        }
                        <div class="text-left mt-3 mb-3" style={{ 'fontWeight': 'bold' }} > {partialTranscript}</div>
                    </div>
                </div>
            </div>
        );
    }

    clearTranscript = () => {
        this.setState({
            transcript: [], // list of finalized transcript
            transcriptBoxs: [], // list of boxed transcript words
            segments: [],
            entities: [],
            partialTranscript: "" // last chunk of transcript, which has not be finalized
        });
    }
}
