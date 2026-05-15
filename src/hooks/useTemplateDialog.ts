import { useState, useCallback } from 'react';
import { DiaryTemplate } from '../types';

interface UseTemplateDialogOptions {
  showAlert: (title: string, message?: string, actions?: any[]) => void;
}

export function useTemplateDialog({ showAlert }: UseTemplateDialogOptions) {
  const [dialogMode, setDialogMode] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<DiaryTemplate | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [dialogAnswers, setDialogAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');

  const startDialog = useCallback((template: DiaryTemplate) => {
    setCurrentTemplate(template);
    setCurrentQuestionIndex(0);
    setDialogAnswers([]);
    setCurrentAnswer('');
    setDialogMode(true);
  }, []);

  const handleNext = useCallback((): string | null => {
    if (!currentTemplate) return null;

    const answers = [...dialogAnswers, currentAnswer];
    setDialogAnswers(answers);

    if (currentQuestionIndex < currentTemplate.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
      return null;
    } else {
      const formattedContent = currentTemplate.questions
        .map((q, i) => answers[i]?.trim() ? q.format(answers[i]) : '')
        .filter(Boolean)
        .join('\n\n');
      setDialogMode(false);
      setCurrentTemplate(null);
      return formattedContent;
    }
  }, [currentTemplate, currentQuestionIndex, dialogAnswers, currentAnswer]);

  const handleBack = useCallback(() => {
    if (currentQuestionIndex > 0) {
      const prevAnswer = dialogAnswers[currentQuestionIndex - 1] || '';
      setCurrentAnswer(prevAnswer);
      setDialogAnswers(dialogAnswers.slice(0, -1));
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex, dialogAnswers]);

  const handleSkip = useCallback((): string | null => {
    if (!currentTemplate) return null;

    const answers = [...dialogAnswers, ''];
    setDialogAnswers(answers);

    if (currentQuestionIndex < currentTemplate.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
      return null;
    } else {
      const formattedContent = currentTemplate.questions
        .map((q, i) => answers[i]?.trim() ? q.format(answers[i]) : '')
        .filter(Boolean)
        .join('\n\n');
      setDialogMode(false);
      setCurrentTemplate(null);
      return formattedContent;
    }
  }, [currentTemplate, currentQuestionIndex, dialogAnswers]);

  const exitDialog = useCallback((): void => {
    showAlert('退出引导', '确定要退出模板引导吗？已回答的内容将保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        onPress: () => {
          setDialogMode(false);
          setCurrentTemplate(null);
        },
      },
    ]);
  }, [showAlert]);

  const getPartialContent = useCallback((): string => {
    if (!currentTemplate) return '';
    const allAnswers = [...dialogAnswers, currentAnswer];
    return currentTemplate.questions
      .map((q, i) => allAnswers[i]?.trim() ? q.format(allAnswers[i]) : '')
      .filter(Boolean)
      .join('\n\n');
  }, [currentTemplate, dialogAnswers, currentAnswer]);

  return {
    dialogMode,
    currentTemplate,
    currentQuestionIndex,
    currentAnswer,
    setCurrentAnswer,
    startDialog,
    handleNext,
    handleBack,
    handleSkip,
    exitDialog,
    getPartialContent,
  };
}
