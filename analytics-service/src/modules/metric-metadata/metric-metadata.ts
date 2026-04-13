export type MetricMetadata = {
	metric: string
	label: string
	description: string
}

const METRIC_LABELS: Record<string, string> = {
	events_total: "Всего событий",
	event_types_covered_count: "Разнообразие активности",
	active_days_count: "Активные дни",
	activity_share_in_team: "Доля активности за период",
	commits_count: "Коммиты",
	pull_requests_created_count: "Созданные PR",
	reviews_submitted_count: "Ревью",
	code_additions: "Добавленные строки",
	code_deletions: "Удаленные строки",
	code_churn: "Code churn",
	net_code_change: "Чистое изменение кода",
	avg_commit_size_lines: "Средний размер коммита",
	avg_pull_request_size_lines: "Средний размер PR",
	median_commit_size_lines: "Медианный размер коммита",
	median_pull_request_size_lines: "Медианный размер PR",
	reviews_per_merged_pull_request: "Ревью на merged PR",
	deletion_to_addition_ratio: "Баланс удалений/добавлений",
	large_commit_ratio: "Доля крупных коммитов",
	large_pull_request_ratio: "Доля крупных PR",
	small_pull_request_ratio: "Доля удобных PR",
	commit_to_pr_ratio: "Коммитов на PR",
	code_churn_per_pr: "Code churn на PR",
	large_changes_count: "Крупные изменения",
	large_change_ratio: "Доля крупных изменений",
	merged_pull_requests_per_100_commits: "Merged PR на 100 коммитов",
	communication_events_total: "Коммуникационные события",
	comments_total_count: "Комментарии",
	issue_comments_count: "Комментарии в issues",
	pull_request_comments_count: "Комментарии в PR",
	reviews_count: "Ревью в коммуникациях",
	labels_changed_count: "Изменения labels",
	assignees_changed_count: "Изменения assignees",
	assignment_events_total: "Назначения",
	comments_per_review_ratio: "Комментарии на ревью",
	review_response_ratio: "Ответы на ревью",
	cross_actor_interaction_ratio: "Кросс-взаимодействия",
	median_review_response_time_sec: "Медианное время ответа",
	p75_review_response_time_sec: "P75 времени ответа",
	time_to_first_review_median_sec: "Время до первого ревью",
	time_to_first_review_p75_sec: "P75 до первого ревью",
	review_queue_pressure: "Давление очереди ревью",
	unanswered_review_request_ratio: "Неотвеченные review requests",
	active_communicators_count: "Активные коммуникаторы",
	review_coverage_rate: "Покрытие ревью",
	issues_reopened_count: "Переоткрытые issues",
	pull_requests_reopened_count: "Переоткрытые PR",
	issue_reopen_rate: "Переоткрытие issues",
	pull_request_reopen_rate: "Переоткрытие PR",
	pull_requests_reviewed_count: "PR с ревью",
	pull_requests_review_requested_count: "Запрошенные ревью",
	merged_without_review_count: "Мержи без ревью",
	merged_without_review_ratio: "Доля мержей без ревью",
	reviews_on_merged_pull_requests_count: "Ревью на merged PR",
	self_review_ratio: "Доля self-review",
	self_merge_ratio: "Доля self-merge",
	post_review_change_ratio: "Доработки после ревью",
	review_iteration_count_avg: "Итерации ревью",
	rework_intensity: "Интенсивность доработок",
	events_ingested_count: "Обработанные события",
	incoming_work_count: "Входящая работа",
	done_work_count: "Закрытая работа",
	work_balance_delta: "Баланс работы",
	throughput_ratio: "Throughput",
	backlog_growth_ratio: "Рост backlog",
	backlog_reduction_ratio: "Сокращение backlog",
	pull_request_cycle_time_median_sec: "Медианный cycle time PR",
	pull_request_cycle_time_p75_sec: "P75 cycle time PR",
	issue_lead_time_median_sec: "Медианный lead time issue",
	issue_lead_time_p75_sec: "P75 lead time issue",
	time_to_merge_after_first_review_median_sec: "Merge после первого ревью",
	issue_backlog_delta: "Прирост backlog issues",
	pull_request_backlog_delta: "Прирост backlog PR",
	total_backlog_delta: "Общий прирост backlog",
	issues_created_count: "Созданные issues",
	health_pull_requests_created_count: "Созданные PR",
	pull_requests_merged_count: "Смерженные PR",
	pull_requests_with_first_review_count: "PR с первым ревью",
	pull_requests_merged_after_review_count: "PR merged после ревью",
	issues_closed_count: "Закрытые issues",
	created_work_count: "Созданная работа",
	issue_close_rate: "Закрытие issues",
	pull_request_merge_rate: "Мерж PR",
	stale_open_work_ratio: "Залежавшаяся работа",
	issue_resolution_ratio: "Разрешение issues",
	reopen_pressure_index: "Индекс переоткрытий",
	queue_stability_index: "Отсутствие накопления backlog",
	discussion_intensity_ratio: "Интенсивность обсуждений",
	label_coverage_ratio: "Покрытие labels",
	assignment_coverage_ratio: "Покрытие assignees",
	typed_issue_ratio: "Типизированные issues",
	repository_members_count: "Участники репозитория",
	inactive_members_ratio: "Неактивные участники",
	bus_factor_risk_index: "Риск bus factor",
	review_load_balance_index: "Баланс ревью",
	open_issues_count: "Открытые issues",
	stale_issues_count: "Залежавшиеся issues",
	open_issue_aging_p75_sec: "P75 возраста open issues",
	stale_issue_ratio: "Доля stale issues",
	open_pull_requests_count: "Открытые PR",
	stale_pull_requests_count: "Залежавшиеся PR",
	open_pull_request_aging_p75_sec: "P75 возраста open PR",
	stale_pull_request_ratio: "Доля stale PR",
	active_contributors_count: "Активные участники",
	contributors_with_commits_count: "Участники с коммитами",
	contributors_with_reviews_count: "Участники с ревью"
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
	events_total: "Общее число GitHub-событий, попавших в выбранный период.",
	event_types_covered_count:
		"Сколько разных типов активности было зафиксировано в выбранном периоде: коммиты, PR, issues, ревью, комментарии.",
	active_days_count: "Количество дней, когда была зафиксирована активность.",
	activity_share_in_team:
		"Доля событий участника в общей активности команды за выбранный период: события участника / все события команды.",
	code_additions: "Количество добавленных строк кода.",
	code_deletions: "Количество удаленных строк кода.",
	code_churn: "Объем измененного кода: добавления плюс удаления.",
	net_code_change: "Чистое изменение кодовой базы: добавления минус удаления.",
	commits_count: "Количество созданных коммитов.",
	pull_requests_created_count: "Количество открытых pull request.",
	reviews_submitted_count: "Количество отправленных ревью.",
	avg_commit_size_lines: "Средний размер коммита в строках изменений.",
	median_commit_size_lines: "Медианный размер коммита в строках изменений.",
	avg_pull_request_size_lines:
		"Средний размер pull request в строках изменений.",
	median_pull_request_size_lines:
		"Медианный размер pull request в строках изменений.",
	deletion_to_addition_ratio:
		"Соотношение удаленных и добавленных строк; оптимален сбалансированный диапазон.",
	large_commit_ratio:
		"Доля крупных коммитов. Чем ниже, тем меньше риск плохо обозримых изменений.",
	large_pull_request_ratio:
		"Доля крупных pull request. Чем ниже, тем меньше риск плохо обозримых изменений.",
	small_pull_request_ratio:
		"Доля pull request в целевом диапазоне размера, удобном для ревью.",
	commit_to_pr_ratio:
		"Сколько коммитов приходится на один pull request.",
	code_churn_per_pr:
		"Средний объем измененных строк на один pull request.",
	large_changes_count:
		"Количество крупных изменений, которые сложнее ревьюить.",
	large_change_ratio:
		"Доля крупных изменений среди всех изменений репозитория.",
	merged_pull_requests_per_100_commits:
		"Сколько merged PR приходится на 100 коммитов.",
	reviews_per_merged_pull_request:
		"Среднее количество ревью на один смерженный pull request.",
	communication_events_total:
		"Общее количество коммуникационных событий: комментарии, ревью, обсуждения.",
	comments_total_count: "Количество комментариев в issues, PR и ревью.",
	issue_comments_count: "Количество комментариев в issues.",
	pull_request_comments_count: "Количество комментариев в pull request.",
	reviews_count: "Количество событий ревью в коммуникационных метриках.",
	labels_changed_count: "Количество событий добавления или удаления labels.",
	assignees_changed_count:
		"Количество событий назначения или снятия assignees.",
	assignment_events_total: "Общее количество событий назначения.",
	comments_per_review_ratio:
		"Соотношение комментариев к количеству ревью.",
	review_response_ratio:
		"Доля review requests, на которые был получен ответ ревьюера.",
	cross_actor_interaction_ratio:
		"Доля взаимодействий между разными участниками, а не только одиночной активности.",
	median_review_response_time_sec:
		"Медианное время ответа на review request.",
	p75_review_response_time_sec:
		"75-й перцентиль времени ответа на review request.",
	time_to_first_review_median_sec:
		"Медианное время от создания pull request до первого ревью.",
	time_to_first_review_p75_sec:
		"75-й перцентиль времени от создания pull request до первого ревью.",
	review_queue_pressure:
		"Количество review requests, по которым не найден последующий review response.",
	unanswered_review_request_ratio:
		"Доля review requests без ответа. В score больше не используется, чтобы не дублировать ответы на ревью.",
	active_communicators_count:
		"Количество участников, проявивших коммуникационную активность.",
	review_coverage_rate: "Доля изменений, прошедших через ревью перед мержем.",
	issue_reopen_rate: "Доля issues, которые были переоткрыты после закрытия.",
	pull_request_reopen_rate:
		"Доля pull request, которые были переоткрыты после закрытия.",
	issues_reopened_count: "Количество переоткрытых issues.",
	pull_requests_reopened_count: "Количество переоткрытых pull request.",
	pull_requests_reviewed_count:
		"Количество pull request, по которым было ревью.",
	pull_requests_review_requested_count:
		"Количество pull request, где запрашивалось ревью.",
	merged_without_review_count: "Количество pull request, смерженных без ревью.",
	merged_without_review_ratio: "Доля pull request, смерженных без ревью.",
	reviews_on_merged_pull_requests_count:
		"Количество ревью, найденных у pull request до merge.",
	self_review_ratio:
		"Доля ревью, где автор pull request совпадает с ревьюером.",
	self_merge_ratio:
		"Доля pull request, где автор сам выполнил merge.",
	post_review_change_ratio:
		"Доля изменений после первого ревью. Сейчас игнорируется в score, потому что события коммитов не связаны с PR.",
	review_iteration_count_avg:
		"Среднее количество ревью на pull request, где было хотя бы одно ревью.",
	rework_intensity:
		"Интенсивность доработок после обратной связи или переоткрытия работы.",
	events_ingested_count:
		"Количество событий, обработанных системой для расчета flow-метрик.",
	incoming_work_count:
		"Количество новой входящей работы: issues и pull request.",
	done_work_count:
		"Количество завершенной работы: закрытые issues и merged PR.",
	work_balance_delta:
		"Разница между входящей и завершенной работой. Рост указывает на накопление очереди.",
	throughput_ratio:
		"Отношение завершенной работы к входящей. Выше означает лучшее прохождение потока.",
	backlog_growth_ratio:
		"Темп роста backlog. Чем ниже, тем стабильнее поток работы.",
	backlog_reduction_ratio:
		"Доля завершенной работы сверх входящей. Выше означает сокращение накопленной очереди.",
	pull_request_cycle_time_median_sec:
		"Медианное время от создания pull request до merge.",
	pull_request_cycle_time_p75_sec:
		"75-й перцентиль времени от создания pull request до merge.",
	issue_lead_time_median_sec:
		"Медианное время от создания issue до закрытия.",
	issue_lead_time_p75_sec:
		"75-й перцентиль времени от создания issue до закрытия.",
	time_to_merge_after_first_review_median_sec:
		"Медианное время от первого ревью pull request до merge.",
	issue_backlog_delta: "Изменение очереди открытых issues за период.",
	pull_request_backlog_delta:
		"Изменение очереди открытых pull request за период.",
	total_backlog_delta: "Суммарное изменение backlog по issues и pull request.",
	issues_created_count: "Количество созданных issues.",
	health_pull_requests_created_count:
		"Количество созданных pull request в метриках здоровья репозитория.",
	pull_requests_merged_count: "Количество pull request, смерженных за период.",
	pull_requests_with_first_review_count:
		"Количество pull request, по которым найдено первое ревью.",
	pull_requests_merged_after_review_count:
		"Количество pull request, которые были смержены после первого ревью.",
	issues_closed_count: "Количество issues, закрытых за период.",
	created_work_count:
		"Суммарное количество созданных issues и pull request.",
	issue_close_rate: "Доля issues, закрытых за период.",
	pull_request_merge_rate: "Доля pull request, смерженных за период.",
	stale_open_work_ratio:
		"Доля входящей работы, которая осталась незавершенной за период.",
	issue_resolution_ratio:
		"Доля созданных issues, которые были закрыты в выбранном периоде.",
	reopen_pressure_index:
		"Индекс давления переоткрытий: насколько часто закрытая работа возвращается обратно.",
	queue_stability_index:
		"Обратная величина накопленного backlog: 1 / (1 + положительный прирост открытой работы). В score больше не используется.",
	discussion_intensity_ratio:
		"Насколько активно команда обсуждает работу относительно объема изменений.",
	label_coverage_ratio:
		"Доля созданных issues и pull request, для которых были события labels.",
	assignment_coverage_ratio:
		"Доля созданных issues и pull request, для которых были события assignment.",
	typed_issue_ratio: "Доля созданных issues, для которых был указан тип.",
	repository_members_count:
		"Количество участников, известных системе для репозитория.",
	inactive_members_ratio:
		"Доля участников репозитория без активности в выбранном периоде.",
	bus_factor_risk_index:
		"Доля активности самого активного участника в общей активности репозитория.",
	review_load_balance_index:
		"Индекс равномерности распределения ревью между участниками.",
	open_issues_count: "Количество issues, открытых на конец дня.",
	stale_issues_count:
		"Количество открытых issues старше выбранного порога.",
	open_issue_aging_p75_sec:
		"75-й перцентиль возраста открытых issues.",
	stale_issue_ratio: "Доля открытых issues, старше выбранного порога.",
	open_pull_requests_count:
		"Количество pull request, открытых на конец дня.",
	stale_pull_requests_count:
		"Количество открытых pull request старше выбранного порога.",
	open_pull_request_aging_p75_sec:
		"75-й перцентиль возраста открытых pull request.",
	stale_pull_request_ratio:
		"Доля открытых pull request, старше выбранного порога.",
	active_contributors_count:
		"Количество участников, у которых была активность в периоде.",
	contributors_with_commits_count:
		"Количество участников, сделавших хотя бы один коммит.",
	contributors_with_reviews_count:
		"Количество участников, участвовавших в ревью."
}

export function metricMetadata(metric: string): MetricMetadata {
	return {
		metric,
		label: METRIC_LABELS[metric] ?? metric,
		description:
			METRIC_DESCRIPTIONS[metric] ?? "Метрика участвует в расчете score."
	}
}

export function listMetricMetadata(): MetricMetadata[] {
	const metrics = new Set([
		...Object.keys(METRIC_LABELS),
		...Object.keys(METRIC_DESCRIPTIONS)
	])

	return [...metrics].sort().map(metric => metricMetadata(metric))
}
