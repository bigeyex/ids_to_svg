import * as opentype from 'opentype.js';
import SVGPath from 'svgpath';
import { SmallParts, UnshrinkParts, PartPosition, VariantPath } from './smallPartList';

const DefaultFontSize = 72;

interface IdsToSvgOptions {
    fontSize?: number,
    color?: string,
}

interface PartLayer {
    pathList: string[],
    x: number,
    y: number,
    sx: number, 
    sy: number,
}

type SVGPathD = string;

interface PathListResultType {
    pathList: SVGPathD[],
    remainingCharacters: string[],
}

export default class IdsToSvg {
    font!: opentype.Font
    fontSize: number
    color: string

    constructor(opts: IdsToSvgOptions) {
        this.fontSize = opts.fontSize || DefaultFontSize;
        this.color = opts.color || 'black';
    }

    static fromFontSync(path: string, options: IdsToSvgOptions = {}) {
        let idsToSvg = new IdsToSvg(options);
        idsToSvg.font = opentype.loadSync(path) as any;
        return idsToSvg;
    }

    static async fromFontAsync(url: string, options: IdsToSvgOptions = {}) {
        const loadFontAsync = () => { // 因为opentype是个老库，所以需要用promise包装一下
            return new Promise((resolve, reject) => {
                opentype.load(url, (err, font) => {
                    if (err !== null) {
                      return reject(err);
                    }
              
                    return resolve(font);
                  });
            })
        }
        let idsToSvg = new IdsToSvg(options);
        idsToSvg.font = await loadFontAsync() as any;
        return idsToSvg;
    }

    svgFromIds(ids: string) {
        const characters = [...ids]; // split unicode strings
        const pathList = this.pathListFromIdsCharacters(characters, this.fontSize).pathList;
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.fontSize}" height="${this.fontSize}">`+
            pathList.map(path => {
                return `<path fill="black" d="${path}"/>`;
            }).join('')+
        `</svg>`;
    }

    // 这里position的目的是，当字符在特定位置，比如“辉”里的“光”，如果在左边，要使用变体
    pathListFromIdsCharacters(characters: string[], fontSize: number, position?: PartPosition): PathListResultType {
        const char = characters[0];
        type PathLayerDimType = {x: number, y: number, sx: number, sy: number, pos?:PartPosition};
        const processCombinedChar = (dims: PathLayerDimType[]) => { // 把剩下的序列按照指定规则变换组合
            let pathLayers:PartLayer[] = [];
            let remainders = characters.slice(1);   // 第一个是描述符，比如"⿰"
            for (let i=0; i<dims.length; i++) {     // 比如"⿰"，有左右两部分，便迭代两次
                const pathResult = this.pathListFromIdsCharacters(remainders, fontSize, dims[i].pos);
                pathLayers.push({pathList: pathResult.pathList, ...dims[i]});
                remainders = pathResult.remainingCharacters;
            }
            return {
                pathList: this.pathListFromCombiningPathLayers(pathLayers),
                remainingCharacters: remainders,
            }
        }
        if (char === '⿰') {    // 如果偏旁是小部件，则只占1/3, 否则各占1/2
            let leftChar = characters[1];
            let rightChar = this.skipOneCharacter(characters.slice(1))[0] || "";
            if (SmallParts.indexOf(leftChar) !== -1 && SmallParts.indexOf(rightChar) === -1) {
                return processCombinedChar([ // 左边是小部件，比如王字旁
                    UnshrinkParts.indexOf(leftChar)!==-1 ? { x: 0, y: 0, sx: 2/3, sy: 1, pos: PartPosition.Left } 
                            : { x: 0, y: 0, sx: 1.2/3, sy: 1, pos: PartPosition.Left },
                    { x: fontSize/3, y: 0, sx: 2/3, sy: 1, pos: PartPosition.Right }, 
                ]);
            }
            else if (SmallParts.indexOf(leftChar) === -1 && SmallParts.indexOf(rightChar) !== -1) {
                return processCombinedChar([
                    { x: 0, y: 0, sx: 2/3, sy: 1, pos: PartPosition.Left },
                    UnshrinkParts.indexOf(rightChar)!==-1 ? { x: fontSize*1/3, y: 0, sx: 2/3, sy: 1, pos: PartPosition.Right } 
                            : { x: fontSize*2/3, y: 0, sx: 1/3, sy: 1, pos: PartPosition.Right }, 
                ]);
            }
            else {
                return processCombinedChar([
                    { x: 0, y: 0, sx: 1/2, sy: 1, pos: PartPosition.Left },
                    { x: fontSize/2, y: 0, sx: 1/2, sy: 1, pos: PartPosition.Right }, 
                ]);
            }
        }
        else if (char === '⿲') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1/3, sy: 1 },
                { x: fontSize/3, y: 0, sx: 1/3, sy: 1 },
                { x: fontSize*2/3, y: 0, sx: 1/3, sy: 1 },
            ])
        } 
        else if (char === '⿱') {  // 如果偏旁是小部件，则只占1/3, 否则各占1/2
            let upChar = characters[1];
            let downChar = this.skipOneCharacter(characters.slice(1))[0] || "";
            if (SmallParts.indexOf(upChar) !== -1 && SmallParts.indexOf(downChar) === -1) {
                return processCombinedChar([ // 上边是小部件，比如宝盖旁
                    UnshrinkParts.indexOf(upChar)!==-1 ? { x: 0, y: 0, sx: 1, sy: 2/3, pos: PartPosition.Up }
                             : { x: 0, y: 0, sx: 1, sy: 1/3, pos: PartPosition.Up },
                    { x: 0, y: fontSize/3, sx: 1, sy: 2/3, pos: PartPosition.Down }, 
                ]);
            }
            else if (SmallParts.indexOf(upChar) === -1 && SmallParts.indexOf(downChar) !== -1) {
                return processCombinedChar([
                    { x: 0, y: 0, sx: 1, sy: 2/3, pos: PartPosition.Up },
                    UnshrinkParts.indexOf(downChar)!==-1 ? { x: 0, y: fontSize*1/3, sx: 1, sy: 2/3, pos: PartPosition.Down }
                             : { x: 0, y: fontSize*2/3, sx: 1, sy: 1/3, pos: PartPosition.Down },
                ])
            }
            else {
                return processCombinedChar([
                    { x: 0, y: 0, sx: 1, sy: 1/2, pos: PartPosition.Up },
                    { x: 0, y: fontSize/2, sx: 1, sy: 1/2, pos: PartPosition.Down },
                ])
            }
            
        } 
        else if (char === '⿳') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1/3 },
                { x: 0, y: fontSize/3, sx: 1, sy: 1/3 },
                { x: 0, y: fontSize*2/3, sx: 1, sy: 1/3 },
            ])
        } 
        else if (char === '⿸') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: fontSize/3, y: fontSize/3, sx: 0.65, sy: 0.65 },
            ])
        } 
        else if (char === '⿺') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: fontSize/3, y: 0, sx: 0.65, sy: 0.65 },
            ])
        } 
        else if (char === '⿹') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0, y: fontSize/3, sx: 0.65, sy: 0.65 },
            ])
        } 
        else if (char === '⿽') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0, y: 0, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿵') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0.17*fontSize, y: 0.19*fontSize, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿷') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0.19*fontSize, y: 0.17*fontSize, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿶') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0.17*fontSize, y: 0.1*fontSize, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿼') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0.1*fontSize, y: 0.17*fontSize, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿴') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0.175*fontSize, y: 0.16*fontSize, sx: 0.65, sy: 0.65 },
            ])
        }
        else if (char === '⿻') {
            return processCombinedChar([
                { x: 0, y: 0, sx: 1, sy: 1 },
                { x: 0, y: 0, sx: 1, sy: 1 },
            ])
        }
        else {
            return {
                pathList: this.pathListFromSingleCharacter(char, fontSize, position),
                remainingCharacters: characters.slice(1),
            }
        }
    }

    pathListFromSingleCharacter(character: string, fontSize: number, position?: PartPosition): SVGPathD[] {
        const fontScale =  1 / this.font.unitsPerEm * fontSize;
        const baseline = fontSize - (this.font.ascender * fontScale - fontSize)
        if (position && character in VariantPath[position]) {   // 如果是变体部件，比如“辉”里的“光”，使用特定的svg
            const path:string = VariantPath[position][character];
            return [SVGPath(path).scale(fontSize / DefaultFontSize, fontSize / DefaultFontSize).round(2).toString()];
        }
        else {
            return [this.font.getPath(character, 0, baseline, fontSize, { kerning:false, letterSpacing:0, tracking:0 }).toPathData(2)];
        }
    }

    pathListFromCombiningPathLayers(pathLayers: PartLayer[]): SVGPathD[] {
        return pathLayers.map(layer => {
            return layer.pathList.map(path => (SVGPath(path)
                .scale(layer.sx, layer.sy).translate(layer.x, layer.y).round(2).toString()))
        }).reduce((a, b) => a.concat(b));
    }

    // 为了调整⿰、⿱遇到,刂等小部件时的尺寸，获取右、下方的元素。可能是IDS符号（不关心）
    skipOneCharacter(characters: string[]): string[] {
        const char = characters[0];

        if (char === '⿰' || char === '⿱' || char === '⿸' || 
            char === '⿺' || char === '⿹' || char === '⿽' || 
            char === '⿵' || char === '⿷' || char === '⿶' ||
            char === '⿼' || char === '⿴' || char === '⿻' ) {
            const remainder = this.skipOneCharacter(characters.slice(1));
            return this.skipOneCharacter(remainder);
        }
        else if (char === '⿲' || char === '⿳' ) {
            let remainder = this.skipOneCharacter(characters.slice(1));
            remainder = this.skipOneCharacter(remainder);
            return this.skipOneCharacter(remainder);
        }
        else {
            return characters.slice(1);
        }
    }

}
declare global {
    interface Window {
        IdsToSvg: any;
    }
  }
  
if (typeof window !== 'undefined') window.IdsToSvg = IdsToSvg;