import React, { Component } from "react";
import { detectEntity } from '../comprehend/DetectEntities';
import * as _ from 'lodash'

export const
    tonkenizeTranscript = async (transcipt, results) => {
    let itemList = _.filter(results[0].Alternatives[0].Items, (item, i) => {
        return item.Type === 'pronunciation' // filter out punctuation
    });
    var originalTranscript = "";
    var transcriptWordList = [];

    // tokenize transcript
    let wordList = transcipt.split(" ");
    var runningIndex = 0;

    _.map(wordList, (word, i) => {
        transcriptWordList.push({
            text: word,
            start: runningIndex,
            end: runningIndex + word.length,
            labels: [],
            confidence: itemList[i].Confidence
        });

        originalTranscript = originalTranscript + word + " ";
        runningIndex = runningIndex + word.length + 1;
    });

    // label each token
    let response = await detectEntity(originalTranscript);
    let entities = response['Entities'];

    _.map(transcriptWordList, (word, i) => {
        _.map(entities, (e, i) => {
            if (parseInt(e['BeginOffset']) === parseInt(word.start)
                || parseInt(e['EndOffset']) === parseInt(word.end)
                || parseInt(e['EndOffset']) === (parseInt(word.end) - 1) // remove punctuation
                || (parseInt(e['BeginOffset']) <= parseInt(word.start) && parseInt(e['EndOffset']) >= parseInt(word.end)) // middle tokens
            ) {
                // label this token
                word.labels.push(e)
            }

            // label word if it's an attribute
            _.map(e['Attributes'], (attr, i) => {
                if (parseInt(attr['BeginOffset']) === parseInt(word.start)
                    || parseInt(attr['EndOffset']) === parseInt(word.end)
                    || parseInt(attr['EndOffset']) === (parseInt(word.end) - 1) // remove punctuation
                    || (parseInt(attr['BeginOffset']) <= parseInt(word.start) && parseInt(attr['EndOffset']) >= parseInt(word.end)) // middle tokens
                ) {
                    // label this token
                    word.labels.push(e)
                }
            })
        })
    })


    console.log(JSON.stringify(transcriptWordList));

    return { wordTokens: transcriptWordList, segmentEntities: entities }
}


export default class Transcript extends Component {
    constructor(props) {
        super(props);

        this.state = {
            wordTokenList: props.words
        }
    }

    componentWillReceiveProps(props) {
        this.setState({
            wordTokenList: props.words
        });
    }

    entityStyle = () => {
        let style = { color: 'black', 'text-decoration': 'none', 'font-size': '18px' };
        return style;
    }


    // hack to remove hightlight of right most boder
    isRightMostBorder = (token) => {
        let entities = token.labels
        var isRightMost = false;
        _.forEach(entities, (e, i) => {
            if (e['Category'] === 'PROTECTED_HEALTH_INFORMATION' || e['Category'] === 'MEDICAL_CONDITION') {
                // right border
                if (e['EndOffset'] === token.end
                    || e['EndOffset'] === token.end - 1 // remove punctuation
                ) {
                    isRightMost = true;
                }
            }
        });
        return isRightMost;
    }

    formatNumber = (n) => {
        if (n < 10) {
            return `0${n}`
        } else {
            return `${n}`
        }
    }

    render() {
        let {wordTokenList } = this.state;
        return (
            <div class="col mr-n3">
                <div class="row mx-n3">
                    <div class="col-12 mr-n3 pr-0 pl-2">
                        <p style={{ 'line-height': '20pt' }}>
                            {
                                _.map(wordTokenList, (token, i) => {
                                    /**
                                     * For right border, ignore space, so that trailing space will not be highlighted
                                     */
                                    let display = this.isRightMostBorder(token) ?
                                        token.text :
                                        token.text + " ";
                                    return (
                                        (token.labels.length > 0) ?
                                            ( // annotated entities
                                                <span>
                                                    <a
                                                        href="#"
                                                        style={this.entityStyle()}>
                                                        {display}
                                                    </a>
                                                    {this.isRightMostBorder(token) &&
                                                        <span>
                                                            {" "}
                                                        </span>
                                                    }
                                                </span>
                                            ) :
                                            ( // normal text
                                                <span style={this.entityStyle()}>
                                                    {display}
                                                </span>
                                            )
                                    )
                                })
                            }
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}