package com.joyent.piranha.test.rbac;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;

@RunWith(Suite.class)
@Suite.SuiteClasses({SubuserTest.class, RoleTest.class, PolicyTest.class,})

public class AdminSuite {
}
