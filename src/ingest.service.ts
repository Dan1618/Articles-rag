import { Injectable } from '@nestjs/common';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class IngestService {
    private readonly directory = 'faiss_store';
    private readonly urlsFile = path.join(this.directory, 'urls.json');

    async ingest(urls: string[]) {
        try {
            console.log('Building new FAISS store...');
            const embeddings = new OpenAIEmbeddings();

            // 1. Load data
            const docs = [];
            for (const url of urls) {
                try {
                    const loader = new CheerioWebBaseLoader(url);
                    const loadedDocs = await loader.load();
                    docs.push(...loadedDocs);
                } catch (e) {
                    console.error(`Failed to load ${url}:`, e);
                }
            }

            if (docs.length === 0) {
                throw new Error('Could not extract content from the provided URLs.');
            }

            // 2. Split data
            const textSplitter = new RecursiveCharacterTextSplitter({
                separators: ['\n\n', '\n', '.', ','],
                chunkSize: 1000,
            });
            const splitDocs = await textSplitter.splitDocuments(docs);

            // 3. Create embeddings and save to FAISS index
            const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);

            if (!fs.existsSync(this.directory)) {
                fs.mkdirSync(this.directory, { recursive: true });
            }
            await vectorStore.save(this.directory);
            fs.writeFileSync(this.urlsFile, JSON.stringify(urls));

            return { status: 'done', message: 'Ingestion complete' };
        } catch (error) {
            console.error('Error during ingestion:', error);
            throw error;
        }
    }
}
