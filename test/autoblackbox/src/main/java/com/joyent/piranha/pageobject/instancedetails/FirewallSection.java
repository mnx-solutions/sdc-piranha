package com.joyent.piranha.pageobject.instancedetails;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.pageobject.AbstractPageObject;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selenide.$;

public class FirewallSection extends AbstractPageObject {

    public SelenideElement getDisableButton(){
        return $(By.xpath("//button[contains(.,'Disable')]"));
    }

    public void clickDisableButton(){
        getDisableButton().click();
    }

    public SelenideElement getEnableButton(){
        return $(By.xpath("//button[contains(.,'Enable')]"));
    }

    public void clickEnableButton(){
        getEnableButton().click();
    }
}
