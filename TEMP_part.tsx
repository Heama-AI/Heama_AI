          style={{
            flex: 1,
            backgroundColor: BrandColors.surface,
            borderRadius: 20,
            padding: 18,
            gap: 6,
            borderWidth: 1,
            borderColor: BrandColors.border,
            ...Shadows.card,
          }}>
          <Text style={{ color: BrandColors.textSecondary }}>?�재 문제</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: BrandColors.primaryDark }}>
            {state.questionIndex + 1} / {questions.length}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: BrandColors.surface,
          borderRadius: 26,
          padding: 24,
          gap: 16,
          borderWidth: 1,
          borderColor: BrandColors.border,
          ...Shadows.card,
        }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary }}>
          {currentQuestion.question}
        </Text>
        <View style={{ gap: 12 }}>
          {currentQuestion.choices.map((choice) => {
            const containerStyle = answerStyle(choice);
            const isSelected = state.selectedChoice === choice;
            const isCorrectChoice = state.showExplanation && choice === currentQuestion.answer;
            const isWrongChoice =
              state.showExplanation && choice === state.selectedChoice && choice !== currentQuestion.answer;
            const textColor = isCorrectChoice
              ? BrandColors.success
              : isWrongChoice
              ? BrandColors.danger
              : isSelected
              ? BrandColors.primary
              : BrandColors.textPrimary;

            return (
              <ChoiceButton
                key={choice}
                choice={choice}
                selected={isSelected}
