import { Controller, Get, Post, Body, Render } from '@nestjs/common';
import { AppService } from './app.service';
import * as dotenv from 'dotenv';

dotenv.config();

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Render('index')
  getHello() {
    return {};
  }

  @Post('submit')
  async submitForm(@Body() body: any) {
    const { link1, link2, link3, question } = body;
    const urls = [link1, link2, link3].filter((url) => !!url);

    if (urls.length === 0 || !question) {
      return {
        status: 'error',
        answer: 'Please provide at least one valid URL and a question.',
      };
    }

    try {
      const result = await this.appService.processLinksAndAnswerQuestion(urls, question);
      return result;
    } catch (error) {
      return {
        status: 'error',
        answer: 'An error occurred during processing: ' + error.message,
      };
    }
  }

  @Post('answer')
  async answerOnly(@Body() body: any) {
    const { question } = body;

    if (!question) {
      return {
        status: 'error',
        answer: 'Please provide a question.',
      };
    }

    try {
      const result = await this.appService.answerQuestion(question);
      return result;
    } catch (error) {
      return {
        status: 'error',
        answer: 'An error occurred during answering: ' + error.message,
      };
    }
  }
}

