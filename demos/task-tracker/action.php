<?php

	require "model.php";
	
	$PDO = new PDO('sqlite:G:/tasks/data.sqlite');

	$available_types = array('tasks', 'users', 'states');
	$available_sorts = array('user_name', 'state', 'assigned_at', 'completed_at');

	if (isset($_GET['get'])) {
		if (isset($_GET['get']) && $_GET['get'] == '') {
			$_GET['get'] = 'tasks,users,states';
		}
			
		$types = explode(",", $_GET['get']);
		
		$data = array();
		
		foreach ($types as $type) {
			$type = preg_replace("/[^a-z0-9_-]/", "", $type);
			$sort = 'id';
			if ($type == 'tasks' && isset($_GET['sort'])) {
				$sort = $_GET['sort'];
				if (!in_array($_GET['sort'], $available_sorts)) {
					$sort = 'assigned_at';
				}
				if ($sort == 'state') $sort = 'state_id';
			}
			if (!in_array($type, $available_types)) continue;
			$data[$type] = getAll($PDO, $type, $sort);
		}
		print_r(json_encode($data));
		exit();
	}
	
	if (isset($_GET['create'])) {
		if (!isset($_POST['title'])) exit("0");
		$data = array(
			"title" => $_POST['title'],
			"description" => $_POST['description'],
			"user_id" => $_POST['user_id'],
			"assigned_at" => $_POST['assigned_at']
		);
		$result = createTask($PDO, $data);
		echo $result > 0 ? "1" : "0";
		exit();
	}
	
	if (isset($_GET['delete']) && isset($_GET['task'])) {
		$result = deleteTask($PDO, (int)$_GET['task']);
		echo $result > 0 ? "1" : "0";
		exit();
	}
	
	if (isset($_GET['update']) && isset($_GET['state']) && isset($_GET['task'])) {
		$result = updateTaskState($PDO, (int)$_GET['task'], (int)$_GET['state']);
		echo $result > 0 ? "1" : "0";
		exit();
	}
	
	if (isset($_GET['update']) && isset($_GET['user']) && isset($_GET['task'])) {
		$result = updateTaskUser($PDO, (int)$_GET['task'], (int)$_GET['user']);
		echo $result > 0 ? "1" : "0";
		exit();
	}
	
	if (isset($_GET['update']) && isset($_GET['assigned_at']) && isset($_GET['task'])) {
		$result = updateTaskAssignedDate($PDO, (int)$_GET['task'], $_GET['assigned_at']);
		echo $result > 0 ? "1" : "0";
		exit();
	}

?>