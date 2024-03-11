<?php

	function getAll($db, $entity, $order='id') {
		
		//Check for SQL injections
		if (!preg_match("/^[a-z0-9_-]+$/", $entity)) return null;
		if (!preg_match("/^[a-z0-9_-]+$/", $order)) $order='id';
		
		$join = "";
		if ($entity == 'tasks' && $order == 'user_name') {
			$join = ' LEFT JOIN `users` ON `users`.`id`=`tasks`.`user_id`';
			$order = str_replace('_', 's`.`', $order);
		}
		$stmt = $db->prepare('SELECT `'.$entity.'`.* FROM `'.$entity.'`'.$join.' ORDER BY `'.$order.'`');
		$stmt->execute();
		return $stmt->fetchAll(PDO::FETCH_ASSOC);
	}
	
	function createTask($db, $data) {
		
		$stmt = $db->prepare('INSERT INTO `tasks` (`title`, `description`, `user_id`, `state_id`, `assigned_at`) VALUES(?, ?, ?, ?, ?)');
		$stmt->execute(array($data['title'], $data['description'], $data['user_id'] > 0 ? $data['user_id'] : null, 1, $data['assigned_at']));
		return $stmt->rowCount() > 0;
	}
	
	function updateTaskState($db, $taskId, $state) {
		
		if ($state == 3) {
			return finishTask($db, $taskId);
		}
		$stmt = $db->prepare('UPDATE `tasks` SET `state_id`=? WHERE `state_id`<3 AND `id`=?');
		$stmt->execute(array($state, $taskId));
		return $stmt->rowCount() > 0;
	}
	
	function finishTask($db, $taskId) {
		
		$date = date("Y-m-d");
		$stmt = $db->prepare('UPDATE `tasks` SET `completed_at`=?, `state_id`=3 WHERE `state_id`<3 AND `id`=?');
		$stmt->execute(array($date, $taskId));
		return $stmt->rowCount() > 0;
	}
	
	function updateTaskUser($db, $taskId, $userId) {
		
		$stmt = $db->prepare('UPDATE `tasks` SET `user_id`=? WHERE `state_id`=1 AND `id`=?');
		$stmt->execute(array($userId, $taskId));
		return $stmt->rowCount() > 0;
	}
	
	function updateTaskAssignedDate($db, $taskId, $assigned) {
		
		$stmt = $db->prepare('UPDATE `tasks` SET `assigned_at`=? WHERE `state_id`<3 AND `id`=?');
		$stmt->execute(array($assigned, $taskId));
		return $stmt->rowCount() > 0;
	}
	
	function deleteTask($db, $taskId) {
		
		$stmt = $db->prepare('DELETE FROM `tasks` WHERE `id`=?');
		$stmt->execute(array($taskId));
		return $stmt->rowCount() > 0;
	}

?>