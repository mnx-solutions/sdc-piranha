package com.joyent.piranha.pageobject;

public class SignupSshPage extends AbstractPageObject {
    public static final String TITLE = "Add SSH Key You need this to create instances";

    @Override
    String getTitle() {
        return TITLE;
    }

}
